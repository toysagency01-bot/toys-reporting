import importlib.util,unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('counts',Path(__file__).parents[1]/'scripts/bsclinic-monthly-counts.py');counts=importlib.util.module_from_spec(s);s.loader.exec_module(counts)
class Rules(unittest.TestCase):
 def test_full_numbers_and_brackets(self):
  for text,main,deferred in [('3(12)',3,12),('13(18)',13,18),('1{3}',1,3),('3 (14) ',3,14),('0(7)',0,7)]:self.assertEqual(counts.parse_count('patients',text),(main,deferred))
  self.assertEqual(counts.parse_count('appointments','[3]'),(3,None))
 def test_no_patient_is_inferred_from_a_deferred_only_or_negative_count(self):
  self.assertEqual(counts.parse_count('patients','- (2)'),(None,2));self.assertEqual(counts.parse_count('patients','-3'),(None,None))
 def test_source_is_preserved_and_client_edits_win(self):
  row={'id':'1','patients':None,'unconfirmed':{'patients':'3(12)'},'spend':9798};resolved=counts.resolve_row(row)
  self.assertEqual(resolved['patients'],3);self.assertEqual(resolved['deferredLeads'],12);self.assertEqual(resolved['sourceAnnotations']['patients'],'3(12)');self.assertEqual(row['patients'],None);self.assertEqual(counts.resolve_row(resolved),resolved)
  edited={'patients':8,'deferredLeads':0,'sourceAnnotations':{'patients':'3(12)'}};self.assertEqual(counts.resolve_row(edited),edited)
if __name__=='__main__':unittest.main()
