"""Optional offline developer audit; Python standard library, no product dependency."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SELECTORS = {
    'limits': ['text-report', 'report'], 'text': ['text-report', 'exports'],
    'report': ['text-report', 'report', 'mapping', 'docs-package', 'cli-unit'],
    'json': ['json', 'report'], 'contracts': ['contracts', 'mapping', 'report'],
    'mapping': ['mapping', 'report'], 'index': ['mapping', 'report', 'cli-unit'],
    'exports': ['exports', 'cli-unit'], 'write-guard': ['write-guard', 'output'],
    'output': ['output', 'cli-unit'], 'cli': ['cli-unit'],
    'attack-coverage-mapper': ['cli-unit'],
}
COMPACT = ['json', 'text-report', 'contracts', 'mapping', 'report', 'exports',
           'write-guard', 'output', 'cli-unit', 'docs-package']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--node', default=shutil.which('node'))
    parser.add_argument('--file', action='append')
    parser.add_argument('--indices', help='Comma-separated one-based inventory indices')
    args = parser.parse_args()
    if not args.node:
        parser.error('Node must be on PATH or supplied with --node')
    root = Path(__file__).resolve().parent.parent
    inventory = json.loads(args.inventory.read_text())
    chosen = {int(x) for x in args.indices.split(',')} if args.indices else None
    entries = [(i, e) for i, e in enumerate(inventory['entries'], 1)
               if (not args.file or e['file'] in args.file) and (not chosen or i in chosen)]
    for _, entry in entries:
        if (entry['file'] not in {f'src/{name}.mjs' for name in SELECTORS}
                and entry['file'] != 'bin/attack-coverage-mapper.mjs'):
            parser.error('Inventory names a file outside the owned product source')
    originals = {e['file']: (root / e['file']).read_text() for _, e in entries}
    generated = subprocess.run([args.node, 'tools/mutation-inventory.mjs'], cwd=root,
                               capture_output=True, text=True, check=True)
    def key(entry):
        return tuple(entry[k] for k in ['file', 'start', 'end', 'original', 'replacement'])
    permitted = {key(e) for e in json.loads(generated.stdout)['entries']}
    for _, entry in entries:
        if key(entry) not in permitted:
            parser.error('Only mechanically enumerated current-source mutations are supported')
        if originals[entry['file']][entry['start']:entry['end']] != entry['original']:
            parser.error('Inventory span differs from the current source; regenerate it')
    outcomes = []
    record = {
        'complete': False,
        'scope': 'Owning selectors followed by all compact in-process selectors for silent candidates; no per-mutant subprocess CLI suite',
        'sourceSha256': {f: hashlib.sha256(s.encode()).hexdigest() for f, s in originals.items()},
        'selectors': SELECTORS, 'compactSelectors': COMPACT,
        'timeoutSeconds': 30, 'entries': outcomes,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)

    def save():
        args.output.write_text(json.dumps(record, indent=2) + '\n')

    with tempfile.TemporaryDirectory(prefix='attack-coverage-mutations-') as directory:
        copy = Path(directory)
        shutil.copytree(root, copy, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('.git', '.superpowers', 'node_modules', '*.tgz'))
        for index, entry in entries:
            path = copy / entry['file']
            original = originals[entry['file']]
            mutant = original[:entry['start']] + entry['replacement'] + original[entry['end']:]
            prohibited = ['node:net', 'node:http', 'node:https', 'node:tls', 'node:dgram',
                          'node:dns', 'node:child_process', 'node:vm', 'undici']
            if any(token in mutant for token in prohibited) or re.search(r'\b(?:fetch|eval|import)\s*\(|\bnew\s+Function\s*\(', mutant):
                parser.error('Mutant has a prohibited capability; refused before execution')
            path.write_text(mutant)
            result = dict(entry, index=index)
            tests = SELECTORS[Path(entry['file']).stem]
            try:
                syntax = subprocess.run([args.node, '--check', str(path)], capture_output=True, timeout=15)
                if syntax.returncode:
                    result['outcome'] = 'invalid'
                else:
                    def check(names):
                        command = [args.node, '--import', './test/support/deny-network.mjs', '--test']
                        command += [f'test/{name}.test.mjs' for name in names]
                        return subprocess.run(command, cwd=copy, capture_output=True, timeout=30)
                    run = check(tests)
                    if run.returncode:
                        result.update(outcome='killed', selector=tests)
                    else:
                        run = check(COMPACT)
                        result.update(outcome='killed-compact' if run.returncode else 'survived', selector=COMPACT)
            except subprocess.TimeoutExpired:
                result['outcome'] = 'timeout'
            finally:
                path.write_text(original)
            outcomes.append(result)
            save()
            print(f"{len(outcomes)}/{len(entries)} index={index} {result['outcome']}", flush=True)
    record['complete'] = True
    record['counts'] = {outcome: sum(e['outcome'] == outcome for e in outcomes)
                        for outcome in sorted({e['outcome'] for e in outcomes})}
    save()


if __name__ == '__main__':
    main()
