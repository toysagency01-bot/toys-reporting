#!/usr/bin/env python3
"""Import an explicitly reviewed private plan and original ZIPs. Read-only unless --apply.
Never creates projects, rewrites existing financial records, or replaces original PDFs.
"""
import argparse,hashlib,importlib.util,json,os,re,urllib.request,zipfile
from pathlib import Path
s=importlib.util.spec_from_file_location('cf',Path(__file__).with_name('configure-client-access.py'));cf=importlib.util.module_from_spec(s);s.loader.exec_module(cf)
def query(sql,params=()):
    # D1's multi-statement HTTP endpoint does not share numbered bindings.
    # Quote each value as a SQL literal before assembling our trusted templates.
    chunks=sql.split('?');assert len(chunks)==len(params)+1
    def literal(v):
        if v is None:return 'NULL'
        if isinstance(v,(int,float)):return str(v)
        return "'"+str(v).replace("'","''")+"'"
    sql=chunks[0]+''.join(literal(v)+chunk for v,chunk in zip(params,chunks[1:]))
    return cf.api('/d1/database/'+cf.DB+'/query','POST',{'sql':sql})[0]['results']
def upload(key,data):
    path=f'https://api.cloudflare.com/client/v4/accounts/{cf.ACCOUNT}/r2/buckets/toys-report-attachments/objects/'+key
    req=urllib.request.Request(path,data=data,method='PUT',headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/pdf'})
    with urllib.request.urlopen(req,timeout=60) as r: response=json.load(r)
    if not response.get('success'):raise RuntimeError('Original upload rejected')
def main():
    p=argparse.ArgumentParser();p.add_argument('plan');p.add_argument('--zip',action='append',default=[]);p.add_argument('--apply',action='store_true');p.add_argument('--receipt',required=True);a=p.parse_args();plan=json.loads(Path(a.plan).read_text())
    tables={r['name'] for r in query("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {'invoice_import_records','invoice_import_mappings','project_billing_profiles'}<=tables,'Apply migration 0032 first.'
    before={t:query('SELECT COUNT(*) n FROM '+t)[0]['n'] for t in ['projects','leads','weekly_reports','project_monthly_reports','crm_milestones']}
    existing={r['id']:r for r in query('SELECT id,fingerprint,invoice_id,original_sha256,original_ready FROM invoice_import_records')}
    for r in plan['records']:
        if r['id'] in existing:assert existing[r['id']]['fingerprint']==r['fingerprint'],'Source changed; manual reconciliation required.'
        if r['project'] and r['data']:
            other=query('SELECT id FROM project_invoices WHERE project_id=? AND number_key=upper(?)',(r['project'],r['number']))
            assert not other or other[0]['id']=='inv_'+r['id'],'Existing invoice number conflict; manual reconciliation required.'
    originals={};by_external={r['externalId']:r for r in plan['records']};assert len(by_external)==len(plan['records'])
    for archive in a.zip:
        with zipfile.ZipFile(archive) as z:
            assert len(z.infolist())<=1000
            for f in z.infolist():
                if f.is_dir():continue
                assert f.file_size<=8*1024*1024
                m=re.fullmatch(r'[^/]+_(\d+)/invoice-[^/]+\.pdf',f.filename);assert m,'Unrecognized original filename'
                external=m[1];assert external in by_external,'Original has no source invoice'
                data=z.read(f);assert data.startswith(b'%PDF-');sha=hashlib.sha256(data).hexdigest()
                assert external not in originals or originals[external][1]==sha,'Conflicting originals'
                originals[external]=(data,sha)
                prior=existing.get(by_external[external]['id']);assert not prior or not prior['original_sha256'] or prior['original_sha256']==sha,'Original replacement forbidden'
    receipt={'apply':a.apply,'source_records':len(plan['records']),'originals':len(originals),'totals':plan['totals'],'protected_before':before}
    print(json.dumps(receipt),flush=True)
    if a.apply:
        for index,r in enumerate(plan['records']):
            # Single D1 statement group per invoice: source record + invoice + link + audit.
            sql=';\n'.join(s['sql'] for s in r['statements']);params=[v for s in r['statements'] for v in s['params']];query(sql,params)
            if r['project'] and r['data']:
                assert query('SELECT invoice_id FROM invoice_import_records WHERE id=?',(r['id'],))[0]['invoice_id']=='inv_'+r['id']
                query('INSERT OR IGNORE INTO invoice_import_mappings(client_key,project_id) VALUES(?,?)',(r['clientKey'],r['project']))
            if (index+1)%25==0:print(json.dumps({'records_done':index+1}),flush=True)
        # Latest verified invoice supplies defaults. Existing defaults are never overwritten.
        for project in sorted({r['project'] for r in plan['records'] if r['project'] and r['data']}):
            candidates=[r for r in plan['records'] if r['project']==project and r['data']]
            preferred=plan['preferredDefaults'].get(project)
            if preferred:candidates=[r for r in candidates if r['clientKey'].endswith(':'+preferred)]
            r=max(candidates,key=lambda r:(r['date'],int(r['number']) if r['number'].isdigit() else 0));d={k:r['data'][k] for k in ['issuer','customer','payment','currency','language']};key='archive-defaults:'+project
            query("INSERT OR IGNORE INTO project_invoice_defaults(project_id,data_json,last_write_key) VALUES(?,?,?); INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT project_id,'invoice.defaults.imported','invoice_defaults',project_id,?,? FROM project_invoice_defaults WHERE project_id=? AND last_write_key=? AND NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)",(project,json.dumps(d,ensure_ascii=False),key,json.dumps({'actor':'system:authorized-invoice-import','version':1}),key,project,key,key))
        for b in plan['billing']:
            query("INSERT OR IGNORE INTO project_billing_profiles(project_id,method,note) SELECT id,?,? FROM projects WHERE slug=?; INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT id,'invoice.billing.updated','invoice_defaults',id,?,? FROM projects WHERE slug=? AND NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)",(b['method'],b['note'],b['slug'],json.dumps({'actor':'system:authorized-invoice-import','status':b['method'],'version':1}),'archive-billing:'+b['slug'],b['slug'],'archive-billing:'+b['slug']))
        for index,(external,(data,sha)) in enumerate(originals.items()):
            r=by_external[external];key=f"documents/org_toys_agency/{r['id']}/{sha}.pdf";prior=query('SELECT original_ready,original_sha256 FROM invoice_import_records WHERE id=?',(r['id'],))[0]
            if not prior['original_ready']:
                upload(key,data)
                query("UPDATE invoice_import_records SET original_key=?,original_sha256=?,original_bytes=?,original_ready=1 WHERE id=? AND (original_sha256 IS NULL OR original_sha256=?); INSERT INTO audit_log(action,entity_type,entity_id,after_json,request_id) SELECT 'invoice.original.imported','invoice_archive',?,?,? WHERE NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)",(key,sha,len(data),r['id'],sha,r['id'],json.dumps({'actor':'system:authorized-invoice-import'}),r['id']+':original',r['id']+':original'))
            if (index+1)%10==0:print(json.dumps({'originals_done':index+1}),flush=True)
        rows=query('SELECT id,invoice_id,currency,total,original_ready FROM invoice_import_records');assert len(rows)==len(plan['records'])
        assert {r['id'] for r in rows}=={r['id'] for r in plan['records']}
        receipt['database_records']=len(rows);receipt['linked']=sum(bool(r['invoice_id']) for r in rows);receipt['database_originals']=sum(r['original_ready'] for r in rows)
        receipt['database_totals']={c:f"{sum(round(float(r['total'])*100) for r in rows if r['currency']==c)/100:.2f}" for c in plan['totals']};assert receipt['database_totals']==plan['totals']
        receipt['protected_after']={t:query('SELECT COUNT(*) n FROM '+t)[0]['n'] for t in before};assert receipt['protected_after']==before
        receipt['by_project']=query('SELECT p.name,count(*) invoices FROM invoice_import_records r JOIN project_invoices i ON i.id=r.invoice_id JOIN projects p ON p.id=i.project_id GROUP BY p.id ORDER BY p.name')
    Path(a.receipt).write_text(json.dumps(receipt,indent=2,ensure_ascii=False));print(json.dumps(receipt,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
