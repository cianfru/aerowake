"""Print private parse facts and optionally compare independently reviewed expectations.

Run from fatigue-tool: python scripts/validate_roster.py roster.pdf [--base DOH] --expected reviewed.json
The input, expectations and output may contain personal data. Keep them outside git.
"""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.preview import parse_for_review
from api.hardening import validate_upload

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--base', help='home base when the roster header states none (CSV or header-less PDF)')
    parser.add_argument('--expected', type=Path)
    args=parser.parse_args()
    content=args.file.read_bytes()
    validate_upload(content,args.file.suffix.lower())
    result=parse_for_review(content,args.file.suffix.lower(),args.base)
    if args.expected:
        expected=json.loads(args.expected.read_text())
        mismatches={k:{'expected':v,'parsed':result.get(k)} for k,v in expected.items() if result.get(k)!=v}
        if mismatches:
            print(json.dumps({'status':'mismatch','mismatches':mismatches},indent=2));sys.exit(1)
        result['expectation_check']='matched supplied expectations (not scientific validation)'
    print(json.dumps(result,indent=2))
