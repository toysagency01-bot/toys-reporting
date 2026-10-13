"""Seal the reviewed BSCLINIC business-source captures in D1; no dashboard publication."""
import importlib.util
import json
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
if Path(__file__).resolve().parents[2] in root.parents:
    raise ValueError('Use a private directory outside Git')
spec = importlib.util.spec_from_file_location('history', Path(__file__).with_name('source-history.py'))
history = importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)
history.BOOKS = {
    '1YGHZIwsziJrHXy-nVoC2RFAA1W-u_8TYW68OrUaWDh8': 'prj_bs_clinic_a5b4',
    '1XIz77iNxMqCqldx5cEX42UedXBem1FKt6x4um6v1zgI': 'prj_bs_clinic_a5b4',
}
bundle = history.read(root / 'prepared/archive.json')
if any(item['sheet_title'].startswith('Лиды') for item in bundle['snapshots']):
    raise ValueError('Contact sheets are outside this dashboard migration')
result = history.transfer(history.Cloudflare(), bundle, apply='--apply' in sys.argv)
history.save(root / 'prepared/cloudflare-archive.json', result)
print(json.dumps(result))
