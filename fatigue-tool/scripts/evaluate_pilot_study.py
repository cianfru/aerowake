"""Usage: python scripts/evaluate_pilot_study.py pilot1.json pilot2.json ..."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from study.evaluation import evaluate

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Provide participant diary JSON exports; keep these files private.')
    print(json.dumps(evaluate([json.loads(Path(p).read_text()) for p in sys.argv[1:]]), indent=2))
