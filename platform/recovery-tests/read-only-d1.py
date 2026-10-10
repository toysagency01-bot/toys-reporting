import json,os,sys,urllib.request
query=json.load(sys.stdin)
if not query['sql'].lstrip().upper().startswith('SELECT '):raise SystemExit('Read-only verification: SELECT required')
url='https://api.cloudflare.com/client/v4/accounts/6e1e68500c0dc88e70dde2da4117c79d/d1/database/0539d3d9-844e-470e-af6e-ae256fe4c81f/query'
req=urllib.request.Request(url,data=json.dumps(query).encode(),headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=45) as response:d=json.load(response)
if not d.get('success'):raise SystemExit(json.dumps(d.get('errors')))
json.dump(d['result'][0],sys.stdout)
