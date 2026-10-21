#!/usr/bin/env python3
"""Extract BSCLINIC's latest 12 monthly blocks; never execute spreadsheet formulas.
Writes a reviewable manifest/SQL. Remote apply is explicit and insert-only.
"""
import argparse,hashlib,json,re,datetime,decimal,importlib.util
from pathlib import Path
import openpyxl
PROJECT='prj_bs_clinic_a5b4'
SLUG='bs-clinic-a5b4'
SHEET='Месячная сводка'
_spec=importlib.util.spec_from_file_location('counts',Path(__file__).with_name('bsclinic-monthly-counts.py'));counts=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(counts)

def number(value,integer=False):
    if isinstance(value,bool) or value is None:return None
    if isinstance(value,(int,float)):
        if value<0 or integer and int(value)!=value:return None
        return int(value) if integer else float(decimal.Decimal(str(value)).quantize(decimal.Decimal('.01')))
    return None  # Count annotations are resolved separately from ordinary numeric cells.

def extract(path):
    book=openpyxl.load_workbook(path,read_only=True,data_only=True)
    rows=list(book[SHEET].values);blocks=[]
    for i,row in enumerate(rows):
        value=str(row[2] or '')
        dates=re.findall(r'\d{2}\.\d{2}\.\d{4}',value)
        if len(dates)!=2:continue
        start,end=[datetime.datetime.strptime(d,'%d.%m.%Y').date().isoformat() for d in dates]
        if start>end:raise ValueError('Reversed period at row '+str(i+1))
        blocks.append((i,start,end))
    reports=[]
    for i,start,end in sorted(blocks,key=lambda b:b[2],reverse=True)[:12]:
        campaign_rows=[];summary='';totals={};position=i
        while position<len(rows):
            row=rows[position];name=str(row[1] or '').strip()
            if position>i and (name=='Рекламная кампания' or len(re.findall(r'\d{2}\.\d{2}\.\d{4}',str(row[2] or '')))==2):break
            if name.startswith('Итог'):
                summary=name.removeprefix('Итог').strip();position+=1;break
            if name and name!='Рекламная кампания' and not re.fullmatch(r'[\d.\s-]+',name):
                raw={};data={'id':'sheet-row-'+str(position+1),'name':name,'sourceRow':position+1}
                for key,col,integer in [('spend',3,False),('reach',4,True),('linkClicks',5,True),('socialClicks',6,True),('clicks',7,True),('leads',9,True),('appointments',12,True),('patients',15,True),('revenue',16,False),('previousLeads',18,True),('previousCpl',19,False)]:
                    value=row[col] if len(row)>col else None;data[key]=number(value,integer)
                    if value is not None and data[key] is None and str(value).strip() not in ['','-','–','—']:raw[key]=str(value)
                if data['spend'] is not None or data['clicks'] is not None:
                    data['unconfirmed']=raw;campaign_rows.append(counts.resolve_row(data))
            elif not name and len(row)>9 and isinstance(row[3],(int,float)):
                totals={'spend':number(row[3]),'leads':number(row[9],True)}
            position+=1
        if not campaign_rows:raise ValueError('No campaigns for '+start)
        for field,value in totals.items():
            actual=round(sum(r[field] or 0 for r in campaign_rows),2)
            if value is not None and abs(actual-value)>.011:raise ValueError(f'Total mismatch {start} {field}: {actual} vs {value}')
        reports.append({'id':'bs-monthly-'+start,'from':start,'to':end,'currency':'CZK','rows':campaign_rows,'summary':summary,'source':{'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sheet':SHEET,'firstRow':i+1,'totals':totals}})
    return {'project':SLUG,'reports':reports}

def quote(v):return "'"+str(v).replace("'","''")+"'"
def sql(report):
    fields=['id','project_id','period_start','period_end','currency','campaigns_json','summary','source_json']
    values=[report['id'],PROJECT,report['from'],report['to'],'CZK',json.dumps(report['rows'],ensure_ascii=False),report['summary'],json.dumps(report['source'],ensure_ascii=False)]
    return 'INSERT INTO project_monthly_reports('+','.join(fields)+') SELECT '+','.join(map(quote,values))+" WHERE EXISTS(SELECT 1 FROM projects WHERE id="+quote(PROJECT)+' AND slug='+quote(SLUG)+') ON CONFLICT(project_id,period_start,period_end) DO NOTHING;'
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('file',type=Path);p.add_argument('--output',type=Path,default=Path('dist/bsclinic-monthly'));a=p.parse_args();manifest=extract(a.file);a.output.mkdir(parents=True,exist_ok=True)
    (a.output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(a.output/'import.sql').write_text('\n'.join(sql(r) for r in manifest['reports']))
    print(json.dumps({'periods':len(manifest['reports']),'campaignRows':sum(len(r['rows']) for r in manifest['reports']),'latest':manifest['reports'][0]['to'],'earliest':manifest['reports'][-1]['from'],'unconfirmed':sum(len(r['unconfirmed']) for p in manifest['reports'] for r in p['rows'])},ensure_ascii=False))
