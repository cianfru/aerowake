"""Usage: python scripts/evaluate_pilot_study.py export1.json export2.json ...

Accepts pilot-study diary exports and duty-debrief exports (kind == 'duty_debriefs')
in any mix; each kind is evaluated separately. Keep these files private.
"""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from study.evaluation import evaluate, evaluate_debriefs


def run(exports):
    debriefs = [e for e in exports if e.get('kind') == 'duty_debriefs']
    observations = [e for e in exports if e.get('kind') != 'duty_debriefs']
    result = {}
    if observations:
        result['observations'] = evaluate(observations)
    if debriefs:
        result['debriefs'] = evaluate_debriefs(debriefs)
    return result


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Provide participant JSON exports (diary or debriefs); keep these files private.')
    print(json.dumps(run([json.loads(Path(p).read_text()) for p in sys.argv[1:]]), indent=2))
