#!/usr/bin/env python3
"""SELECT-only Monorey advertising export. No other project or credentials.

Usage: python export-monorey-sheets.py PRIVATE_JSON [from-date]
Default: refresh the latest 30 account-local days, never before 2026-10-16.
"""
import datetime,decimal,json,os,pathlib,sys,urllib.request
from zoneinfo import ZoneInfo

def export(target,from_date=None):
    today=datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date()
    start=max(datetime.date(2026,10,16),today-datetime.timedelta(days=29)) if not from_date else datetime.date.fromisoformat(from_date)
    assert datetime.date(2026,10,16)<=start<=today
    sql="""SELECT json_object(
    'project',(SELECT json_object('id',id,'slug',slug,'status',status) FROM projects WHERE id='prj_monorey_acdk'),
    'integration',(SELECT json_object('id',id,'account',external_account_id,'status',status) FROM integrations WHERE id='int_monorey_meta' AND project_id='prj_monorey_acdk'),
    'import',(SELECT json_object('state',state,'lastSuccess',last_success_at) FROM ads_import_status WHERE integration_id='int_monorey_meta'),
    'snapshots',json((SELECT json_group_array(json_object('date',local_date,'checkedAt',checked_at,'hash',content_hash,'payload',json(payload_json))) FROM (SELECT * FROM ads_daily_snapshots WHERE project_id='prj_monorey_acdk' AND integration_id='int_monorey_meta' AND provider='meta_ads' AND local_date BETWEEN ? AND ? ORDER BY local_date)))) AS snapshot"""
    endpoint='https://api.cloudflare.com/client/v4/accounts/6e1e68500c0dc88e70dde2da4117c79d/d1/database/0539d3d9-844e-470e-af6e-ae256fe4c81f/query'
    req=urllib.request.Request(endpoint,data=json.dumps({'sql':sql,'params':[start.isoformat(),today.isoformat()]}).encode(),headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=60) as response:result=json.load(response)
    assert result.get('success') and result['result'][0].get('success'),'D1 export failed'
    data=json.loads(result['result'][0]['results'][0]['snapshot'])
    assert data['project']=={'id':'prj_monorey_acdk','slug':'monorey-acdk','status':'active'}
    assert data['integration']=={'id':'int_monorey_meta','account':'1139444467187528','status':'active'}
    assert data['import']['state']=='success','Import is not confirmed successful'
    last=datetime.datetime.fromisoformat(data['import']['lastSuccess'].replace('Z','+00:00'))
    assert datetime.datetime.now(datetime.timezone.utc)-last<datetime.timedelta(hours=2),'Source import stale'
    expected=[(start+datetime.timedelta(days=n)).isoformat() for n in range((today-start).days+1)]
    assert [s['date'] for s in data['snapshots']]==expected,'Missing source dates'
    D=decimal.Decimal
    def metric(m,k):
        v=m.get(k)
        return D(str(v['value'])) if v and v.get('state')=='observed' and v.get('value') is not None else None
    rows=[];controls=[]
    for day in data['snapshots']:
        payload=day['payload'];h=payload['hierarchy'];date=day['date']
        assert payload['integrationId']=='int_monorey_meta' and payload['provider']=='meta_ads'
        assert h['providerId']=='1139444467187528' and h['currency']=='EUR' and h['timezone']=='America/Los_Angeles'
        account=[r for r in h.get('dailyMetrics',[]) if r['date']==date];assert len(account)==1
        per=[];seen=set()
        for campaign in h.get('children',[]):
            daily=[r for r in campaign.get('dailyMetrics',[]) if r['date']==date]
            if not daily:continue
            assert len(daily)==1 and campaign['providerId'] not in seen;seen.add(campaign['providerId'])
            metrics={k:metric(daily[0]['metrics'],k) for k in ['impressions','clicks','spend','conversions','conversionValue']}
            assert all(metrics[k] is not None for k in ['impressions','clicks','spend'])
            per.append(metrics)
            rows.append({'date':date,'campaignId':campaign['providerId'],'values':[date,'Meta Ads','Monorey','act_1139444467187528','EUR',campaign['name'],*[float(metrics[k]) if metrics[k] is not None else None for k in ['impressions','clicks','spend','conversions','conversionValue']]]})
        for key in ['impressions','clicks','spend','conversions']:
            actual=metric(account[0]['metrics'],key)
            if actual is None:continue
            assert all(p[key] is not None for p in per)
            total=sum((p[key] for p in per),D(0));assert abs(total-actual)<=(D('.01') if key=='spend' else D(0)),'Account/campaign mismatch'
        controls.append({'date':date,'campaigns':len(per)})
    rows.sort(key=lambda r:(r['date'],r['campaignId']))
    out={'schema':'monorey-sheets-export/1','spreadsheetId':'1U-SaleigXPA34hPGs7eF0UqtkCy3okwptq0Q7Xx8Cis','sheetId':2022069134,'from':start.isoformat(),'to':today.isoformat(),'fetchedAt':data['import']['lastSuccess'],'rows':rows,'controls':controls}
    path=pathlib.Path(target).resolve()
    for repo in [pathlib.Path('/workspace/toys-unified'),pathlib.Path('/workspace/toys-reporting')]:
        assert not path.is_relative_to(repo),'Private output must stay outside Git'
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700);fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as file:json.dump(out,file,ensure_ascii=False)
    print(json.dumps({'file':str(path),'from':out['from'],'to':out['to'],'days':len(controls),'campaignRows':len(rows)}))

if __name__=='__main__':export(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else None)
