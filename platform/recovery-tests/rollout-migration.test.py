import importlib.util,unittest
from pathlib import Path
p=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('restore',p/'scripts/restore-rollout-leads.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class HistoryTests(unittest.TestCase):
 def test_dates_keep_offsets_and_source_timezone(self):
  self.assertEqual(r.timestamp('2026-10-14T01:02:03+02:00','America/Los_Angeles'),'2026-10-13T23:02:03Z')
  self.assertEqual(r.timestamp('2026-10-14 1:02:03','Europe/Prague'),'2026-10-13T23:02:03Z')
  self.assertEqual(r.timestamp('10/31/23, 11:06 AM','Europe/Prague'),'2023-10-31T10:06:00Z')
  self.assertEqual(r.timestamp('01.15.2024','Europe/Prague'),'2024-01-14T23:00:00Z')
 def test_invalid_dates_are_not_replaced_with_today(self):
  for s in ['0','ноябрь','2026-02-30','LEADS / CZ / 26.04','']:self.assertIsNone(r.timestamp(s,'Europe/Prague'))
 def test_historical_appointment_is_not_a_sale_or_qualified_property_viewing(self):
  self.assertEqual(r.mapped_status('murmur','Запись'),'В работе')
  self.assertEqual(r.mapped_status('taycher','Meeting scheduled'),'Связались')
  self.assertEqual(r.mapped_status('monorey','Оплата'),'Продажа')
  self.assertEqual(r.mapped_status('amklinika','Работа завершена'),'Завершён')
if __name__=='__main__':unittest.main()
