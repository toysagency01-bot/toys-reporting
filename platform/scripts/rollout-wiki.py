#!/usr/bin/env python3
"""Add the isolated WIKI tables and seed once from a private, reviewed export.

Default is read-only preflight. --apply creates only missing WIKI tables.
--apply --seed /private/export.json imports into an empty WIKI; it never
overwrites existing editorial changes or modifies users, projects or finance.
"""
import argparse, hashlib, importlib.util, json
from pathlib import Path

spec=importlib.util.spec_from_file_location('cf',Path(__file__).with_name('configure-client-access.py'))
cf=importlib.util.module_from_spec(spec);spec.loader.exec_module(cf)
def query(sql,params=None):
    return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql,**({'params':params} if params else {})})[0]['results']
def digest(pages):
    fields=['id','parentId','title','body','sortOrder']
    normalized=[{k:p[k] for k in fields} for p in sorted(pages,key=lambda p:p['id'])]
    return hashlib.sha256(json.dumps(normalized,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def stored():
    return query('SELECT id,parent_id AS parentId,title,body,sort_order AS sortOrder,version FROM wiki_pages ORDER BY id')
def protected():
    return {t:query('SELECT count(*) AS n FROM '+t)[0]['n'] for t in ['users','platform_user_roles','project_memberships','projects','leads','finance_records','project_invoices']}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--seed');args=parser.parse_args()
    tables={'wiki_pages','wiki_revisions'}
    existing={p['name'] for p in query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('wiki_pages','wiki_revisions')")}
    assert not existing or existing==tables,'Partial WIKI schema; inspect before continuing.'
    before=protected()
    if args.apply and not existing:query(Path('migrations/0040_team_wiki.sql').read_text())
    expected=None
    if args.seed:
        seed=json.loads(Path(args.seed).read_text());assert seed['schema']=='toys-wiki-seed/1'
        pages=seed['pages'];ids={p['id'] for p in pages};assert len(ids)==len(pages)==63,'Unexpected source coverage.'
        assert all(not p['parentId'] or p['parentId'] in ids for p in pages),'Missing parent.'
        assert all(p['title'].strip() and p['body'].strip() and len(p['title'])<=180 and len(p['body'])<=60000 for p in pages)
        expected=digest(pages)
        if args.apply:
            current=stored()
            if current:
                assert digest(current)==expected and all(p['version']==1 for p in current),'Existing WIKI differs; never overwrite editorial changes.'
            else:
                query("INSERT INTO wiki_pages(id,parent_id,title,body,sort_order,updated_by) SELECT json_extract(value,'$.id'),json_extract(value,'$.parentId'),json_extract(value,'$.title'),json_extract(value,'$.body'),json_extract(value,'$.sortOrder'),'reviewed-wiki-import' FROM json_each(?) WHERE NOT EXISTS(SELECT 1 FROM wiki_pages)",[json.dumps(pages,ensure_ascii=False)])
            assert digest(stored())==expected,'Imported text does not match the reviewed export.'
            query('INSERT INTO wiki_revisions(page_id,version,title,body,actor,created_at) SELECT p.id,p.version,p.title,p.body,p.updated_by,p.updated_at FROM wiki_pages p WHERE NOT EXISTS(SELECT 1 FROM wiki_revisions r WHERE r.page_id=p.id AND r.version=p.version)')
            assert query('SELECT count(*) AS n FROM wiki_revisions')[0]['n']==63
    assert protected()==before,'Protected table counts changed; inspect concurrent activity.'
    result={'applied':args.apply,'existingTables':sorted(existing),'protectedCountsUnchanged':True,'expectedContentSha256':expected}
    if args.apply:
        result.update(pages=len(stored()),revisions=query('SELECT count(*) AS n FROM wiki_revisions')[0]['n'],contentSha256=digest(stored()))
        Path('dist/wiki-rollout.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
