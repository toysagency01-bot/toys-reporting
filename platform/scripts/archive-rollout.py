#!/usr/bin/env python3
"""Private archive of the seven approved projects, including CRM and feedback.

The archive is never served by public dashboard/material endpoints. Uses the
same sealed, checksummed snapshots as business history, with explicitly broader
CRM scope. Source formulas/links are retained; credential-marked cells are omitted.
"""
import argparse,copy,importlib.util,json,os,re
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('history',BASE/'scripts/source-history.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
PLAN=json.loads((BASE/'imports/rollout-20261013.json').read_text());BOOKS={b:p['id']for p in PLAN for b in [p.get('adsBook'),p['projectBook']]if b}
SCOPE='approved_rollout_private_business_and_crm'
MARKER=re.compile(r'access[_ ]?token|client[_ ]?secret|api[_ ]?key|пароль|password|bearer ',re.I)
def validate(item,envelope):
 if BOOKS.get(item['workbook_id'])!=item['project_id']:raise ValueError('Project scope mismatch')
 if MARKER.search(h.canonical(envelope)):raise ValueError('Credential-marked source content requires removal')
def prepare(root):
 snapshots=[];redactions=[]
 for book,project in BOOKS.items():
  metadata=h.read(root/f'sources/{book}.metadata.json')
  for tab in metadata['sheets']:
   prop=tab['properties'];name=f'{book}.{prop["sheetId"]}.json';business=root/'sources'/name;private=root/'private-contacts'/name
   if business.exists() and private.exists():raise ValueError('Ambiguous source capture')
   capture=h.read(business if business.exists() else private)
   assert capture['properties']==prop
   source_hash=h.digest(h.canonical(capture['data']));removed=[]
   for grid in capture['data']['sheets'][0].get('data',[]):
    for i,row in enumerate(grid.get('rowData',[])):
     for j,cell in enumerate(row.get('values',[])):
      if MARKER.search(h.canonical(cell)):
       removed.append({'row':grid.get('startRow',0)+i+1,'column':grid.get('startColumn',0)+j+1})
       row['values'][j]={'formattedValue':'[Служебная ячейка оставлена в исходной таблице]','effectiveValue':{'stringValue':'[Служебная ячейка оставлена в исходной таблице]'}}
   if removed:
    capture['data']['migrationRedactions']={'originalCaptureHash':source_hash,'cells':removed}
    redactions.append({'workbook':book,'sheet':prop['title'],'cells':removed})
   item=h.snapshot(book,project,metadata,capture);validate(item,h.validate_pages(item,item['pages']));snapshots.append(item)
 bundle={'version':1,'scope':SCOPE,'snapshots':snapshots};h.save(root/'prepared/private-archive.json',bundle)
 summary={'snapshots':len(snapshots),'pages':sum(s['page_count']for s in snapshots),'redactions':redactions,'projects':{p['key']:sum(s['project_id']==p['id']for s in snapshots)for p in PLAN}}
 h.save(root/'prepared/private-archive-summary.json',summary);return summary
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('action',choices=['prepare','apply','verify']);ap.add_argument('root',type=Path);g=ap.add_mutually_exclusive_group();g.add_argument('--sqlite',type=Path);g.add_argument('--cloudflare',action='store_true');a=ap.parse_args();root=a.root.resolve();assert BASE.parent not in root.parents;os.umask(0o077)
 if a.action=='prepare':result=prepare(root)
 else:
  if not(a.sqlite or a.cloudflare):ap.error('Select target')
  result=h.transfer(h.Cloudflare() if a.cloudflare else h.SQLite(a.sqlite),h.read(root/'prepared/private-archive.json'),apply=a.action=='apply',scope=SCOPE,books=BOOKS,validator=validate)
  h.save(root/f'prepared/{"cloudflare" if a.cloudflare else "local"}-archive-{a.action}.json',result)
 print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
