import importlib.util,sys,types,unittest
from pathlib import Path
from unittest.mock import patch,AsyncMock
root=Path(__file__).parent
package=types.ModuleType('crm_test_package');package.__path__=[str(root)];sys.modules['crm_test_package']=package
service=types.ModuleType('crm_test_package.service');service._client=lambda settings:None;sys.modules[service.__name__]=service
spec=importlib.util.spec_from_file_location('crm_test_package.crm_bridge',root/'crm_bridge.py');bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)

class BridgeTests(unittest.IsolatedAsyncioTestCase):
 async def test_pagination(self):
  c=types.SimpleNamespace(_request=AsyncMock(side_effect=[{'data':[{'id':'1'}],'paging':{'next':'unused','cursors':{'after':'next'}}},{'data':[{'id':'2'}]}]))
  self.assertEqual(await bridge.paginate(c,'me/accounts','id'),[{'id':'1'},{'id':'2'}]);self.assertEqual(c._request.call_args.kwargs['params']['after'],'next')
 async def test_duplicate_cursor_rejected(self):
  c=types.SimpleNamespace(_request=AsyncMock(return_value={'data':[],'paging':{'next':'unused','cursors':{'after':'repeat'}}}))
  with self.assertRaises(ValueError):await bridge.paginate(c,'me/accounts','id')
 async def test_discovery_closes_client_and_delivers_only_to_pinned_receiver(self):
  async def graph(method,path,**kwargs):
   if path=='me/accounts':return {'data':[{'id':'123','name':'Synthetic','access_token':'page-secret'}]}
   if path=='me/adaccounts':return {'data':[{'id':'act_456','account_id':'456','name':'Synthetic'}]}
   return {'data':[]}
  c=types.SimpleNamespace(_request=AsyncMock(side_effect=graph),close=AsyncMock())
  class HTTP:
   async def __aenter__(self):return self
   async def __aexit__(self,*args):pass
   async def post(this,url,**kwargs):
    self.assertEqual(url,bridge.RECEIVER);self.assertEqual(kwargs['json']['pages'][0]['token'],'page-secret')
    return types.SimpleNamespace(status_code=200,json=lambda:{'ok':True})
  settings=types.SimpleNamespace(meta_access_token='synthetic-secret',meta_app_secret=None)
  with patch.object(bridge,'_client',return_value=c),patch.object(bridge.id_token,'fetch_id_token',return_value='synthetic-identity'),patch.object(bridge.httpx,'AsyncClient',return_value=HTTP()):
   result=await bridge.run_crm_bridge(settings)
  self.assertEqual(result['pages'],1);self.assertNotIn('secret',str(result));c.close.assert_awaited_once()

if __name__=='__main__':unittest.main()
