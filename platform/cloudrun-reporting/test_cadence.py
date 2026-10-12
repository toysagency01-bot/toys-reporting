import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('cadence', Path(__file__).with_name('set-cadence.py'))
cadence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cadence)


class CadenceTest(unittest.TestCase):
    def setup_jobs(self):
        return {cadence.BASE: {'name': cadence.BASE, 'state': 'ENABLED', 'schedule': '*/20 * * * *',
            'timeZone': 'Etc/UTC', 'attemptDeadline': '900s',
            'httpTarget': {'uri': cadence.URL + '/scheduled/google-reporting', 'httpMethod': 'POST',
                'body': 'e30=', 'oidcToken': {'serviceAccountEmail': cadence.EMAIL, 'audience': cadence.URL}}}}

    def api(self, jobs, fail=False):
        def call(path, method='GET', body=None, missing=False):
            key = path.split('?')[0]
            if method == 'GET':
                return copy.deepcopy(jobs.get(key))
            if method == 'POST':
                jobs[body['name']] = {**copy.deepcopy(body), 'state': 'ENABLED'}
            if method == 'PATCH':
                if fail and key == cadence.BASE and body['schedule'] == '0 * * * *':
                    raise RuntimeError('Synthetic update failure')
                jobs[key].update(copy.deepcopy(body))
            if method == 'DELETE':
                del jobs[key]
        return call

    def test_preserves_delivery_and_can_run_twice(self):
        jobs = self.setup_jobs()
        original = copy.deepcopy(jobs[cadence.BASE])
        backups = []
        for _ in range(2):
            cadence.apply(self.api(jobs), backups.append)
        self.assertEqual(len(jobs), 2)
        self.assertEqual(jobs[cadence.BASE]['schedule'], '0 * * * *')
        self.assertEqual(jobs[cadence.DAY]['schedule'], '20,40 9-23 * * *')
        for job in jobs.values():
            self.assertEqual(job['httpTarget'], original['httpTarget'])
            self.assertEqual(job['timeZone'], 'Asia/Tbilisi')
        self.assertEqual(backups[0]['original'], original)

    def test_rolls_back_if_base_update_fails(self):
        jobs = self.setup_jobs()
        original = copy.deepcopy(jobs)
        with self.assertRaisesRegex(RuntimeError, 'Synthetic'):
            cadence.apply(self.api(jobs, fail=True), lambda _: None)
        self.assertEqual(jobs, original)

    def test_does_not_overwrite_unrelated_or_paused_jobs(self):
        jobs = self.setup_jobs()
        jobs[cadence.BASE]['state'] = 'PAUSED'
        with self.assertRaisesRegex(RuntimeError, 'no updates'):
            cadence.apply(self.api(jobs), lambda _: self.fail('Unexpected backup'))


if __name__ == '__main__':
    unittest.main()
