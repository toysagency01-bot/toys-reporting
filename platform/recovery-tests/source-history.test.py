import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('history', Path(__file__).resolve().parents[1] / 'scripts/source-history.py')
history = importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)
spec_content = importlib.util.spec_from_file_location('content', Path(__file__).resolve().parents[1] / 'scripts/apply-history-content.py')
content = importlib.util.module_from_spec(spec_content)
spec_content.loader.exec_module(content)


class HistoryTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db = history.SQLite(Path(self.directory.name) / 'test.db')
        self.db.query('CREATE TABLE projects(id TEXT PRIMARY KEY)')
        self.book, self.project = next(iter(history.BOOKS.items()))
        self.db.query('INSERT INTO projects VALUES (?)', [self.project])
        self.sheet = {'sheetId': 12, 'title': 'История', 'hidden': True}
        self.capture = {'spreadsheetId': self.book, 'properties': self.sheet, 'fetchedAt': '2026-10-12T18:00:00Z',
                        'data': {'spreadsheetId': self.book, 'sheets': [{'properties': self.sheet, 'data': [{'rowData': [
                            {'values': [{'userEnteredValue': {'formulaValue': '=1+2'}, 'effectiveValue': {'numberValue': 3},
                                         'note': 'synthetic', 'hyperlink': 'https://example.com'}]}, {},
                            {'values': [{}, {'effectiveValue': {'stringValue': 'Тест'}}]}]}]}]}}
        self.metadata = {'spreadsheetUrl': 'https://example.com/source', 'properties': {'timeZone': 'Europe/Prague'}}
        self.item = history.snapshot(self.book, self.project, self.metadata, self.capture)
        self.bundle = {'version': 1, 'scope': 'business_source_history_only', 'snapshots': [self.item]}

    def tearDown(self):
        self.db.db.close()
        self.directory.cleanup()

    def test_roundtrip_preserves_formulas_empty_cells_links_and_hidden_metadata(self):
        restored = history.validate_pages(self.item, self.item['pages'])
        self.assertEqual(restored['data'], self.capture['data'])
        self.assertTrue(restored['sheet']['hidden'])
        self.assertEqual(self.item['row_count'], 3)
        self.assertEqual(self.item['formula_count'], 1)
        self.assertEqual(self.item['hyperlink_count'], 1)

    def test_second_apply_and_recapture_write_nothing(self):
        history.transfer(self.db, self.bundle, apply=True)
        before = self.db.db.total_changes
        capture = copy.deepcopy(self.capture)
        capture['fetchedAt'] = '2026-10-13T00:01:00Z'
        bundle = {**self.bundle, 'snapshots': [history.snapshot(self.book, self.project, self.metadata, capture)]}
        self.assertEqual(history.transfer(self.db, bundle, apply=True)['inserted_pages'], 0)
        history.transfer(self.db, bundle)
        self.assertEqual(self.db.db.total_changes, before)

    def test_resumes_incomplete_snapshot_and_seals_only_after_readback(self):
        self.db.schema()
        self.db.query('INSERT INTO source_history_snapshots (' + ','.join(history.FIELDS) + ') VALUES (' +
                      ','.join('?' for _ in history.FIELDS) + ')', [self.item[field] for field in history.FIELDS])
        with self.assertRaisesRegex(ValueError, 'Missing archive page'):
            history.transfer(self.db, self.bundle)
        result = history.transfer(self.db, self.bundle, apply=True)
        self.assertEqual(result['inserted_snapshots'], 0)
        self.assertEqual(result['inserted_pages'], 1)
        self.assertEqual(self.db.query('SELECT complete FROM source_history_snapshots')[0]['complete'], 1)

    def test_corrupt_existing_content_is_never_overwritten(self):
        history.transfer(self.db, self.bundle, apply=True)
        self.db.query("UPDATE source_history_pages SET payload_json='{}'")
        with self.assertRaisesRegex(ValueError, 'Conflicting archive page'):
            history.transfer(self.db, self.bundle, apply=True)

    def test_project_scope_and_content_tampering_are_rejected(self):
        for field, value in [('project_id', 'different-project'), ('source_hash', 'different-hash')]:
            bundle = copy.deepcopy(self.bundle)
            bundle['snapshots'][0][field] = value
            with self.assertRaises(ValueError):
                history.transfer(self.db, bundle, apply=True)

    def test_lead_sheet_and_contact_payload_cannot_be_uploaded(self):
        envelope = history.validate_pages(self.item, self.item['pages'])
        with self.assertRaisesRegex(ValueError, 'excluded'):
            history.assert_business_scope({**self.item, 'workbook_id': '1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms', 'sheet_id': 612493655}, envelope)
        envelope['data']['sheets'][0]['data'][0]['rowData'][0]['values'][0]['note'] = 'person@example.com'
        with self.assertRaisesRegex(ValueError, 'Email-like'):
            history.assert_business_scope(self.item, envelope)


class ContentTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db = history.SQLite(Path(self.directory.name) / 'test.db')
        self.fields = content.FIELDS['project_tabs']
        self.db.query('CREATE TABLE project_tabs (' + ','.join(k + ' TEXT' for k in self.fields) + ')')
        self.before = {k: None for k in self.fields}
        self.before.update(id='tab_synthetic', project_id='prj_housevip_cxp7', source_title='План работ (Meta)',
                           content_json='{"old":true}', updated_at='2026-10-01')
        self.db.query('INSERT INTO project_tabs (' + ','.join(self.fields) + ') VALUES (' +
                      ','.join('?' for _ in self.fields) + ')', [self.before[k] for k in self.fields])
        self.after = {**self.before, 'content_json': '{"new":true}', 'updated_at': '2026-10-12'}
        self.plan = {'version': 1, 'scope': 'history_materials_and_period_reports',
                     'changes': [{'table': 'project_tabs', 'before': self.before, 'after': self.after}]}

    def tearDown(self):
        self.db.db.close()
        self.directory.cleanup()

    def test_idempotent_apply_and_immutable_report_guard(self):
        self.assertEqual(content.apply_plan(self.db, self.plan, True)['applied'], 1)
        changes = self.db.db.total_changes
        self.assertEqual(content.apply_plan(self.db, self.plan, True)['already_current'], 1)
        self.assertEqual(self.db.db.total_changes, changes)
        report = {k: None for k in content.FIELDS['weekly_reports']}
        report.update(id='report_synthetic', project_id='prj_housevip_cxp7')
        with self.assertRaisesRegex(ValueError, 'immutable'):
            content.validate({'table': 'weekly_reports', 'before': report, 'after': report})

    def test_edit_after_readback_is_preserved(self):
        self.db.query("UPDATE project_tabs SET content_json='native edit'")
        with self.assertRaisesRegex(ValueError, 'changed since readback'):
            content.apply_plan(self.db, self.plan, True)
        self.assertEqual(self.db.query('SELECT content_json FROM project_tabs')[0]['content_json'], 'native edit')

    def test_edit_between_preflight_and_write_is_preserved(self):
        original_query = self.db.query

        def racing_query(sql, params=()):
            if sql.startswith('UPDATE project_tabs SET id='):
                original_query("UPDATE project_tabs SET content_json='concurrent edit'")
            return original_query(sql, params)

        self.db.query = racing_query
        with self.assertRaisesRegex(ValueError, 'Concurrent edit preserved'):
            content.apply_plan(self.db, self.plan, True)
        self.assertEqual(self.db.query('SELECT content_json FROM project_tabs')[0]['content_json'], 'concurrent edit')


if __name__ == '__main__':
    unittest.main()
