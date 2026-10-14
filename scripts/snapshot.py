#!/usr/bin/env python3
"""Capture a read-only source snapshot; never execute repository code."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone
import uuid

EXCLUDED = {'.git', 'node_modules', '.next', 'dist', 'build', 'coverage', 'vendor', '.cache', '.turbo', '__pycache__'}
SUFFIXES = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.scss', '.yaml', '.yml', '.html', '.sql', '.graphql'}

def allowed(path):
    return not (set(path.parts) & EXCLUDED) and not path.name.startswith('.env') and path.suffix not in {'.pem', '.key', '.p12'}

def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True)
    return result.stdout.decode('utf8', errors='replace').strip() if result.returncode == 0 else None

def source_paths(root):
    result = subprocess.run(['git', '-C', str(root), 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], capture_output=True)
    if result.returncode == 0:
        candidates = [Path(os.fsdecode(name)) for name in result.stdout.split(b'\0') if name]
    else:
        candidates = []
        for base, dirs, names in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in EXCLUDED and not (Path(base) / d).is_symlink())
            candidates.extend((Path(base) / name).relative_to(root) for name in names)
    for relative in sorted(set(candidates)):
        file = (root / relative).resolve()
        if allowed(relative) and file.is_relative_to(root) and file.is_file() and (relative.suffix in SUFFIXES or relative.name in {'Dockerfile', 'AGENTS.md'}) and file.stat().st_size <= 2_000_000:
            yield relative, file

def fingerprint(root):
    digest = hashlib.sha256()
    for relative, file in source_paths(root):
        digest.update(str(relative).encode()); digest.update(b'\0'); digest.update(hashlib.sha256(file.read_bytes()).digest())
    return digest.hexdigest()

def snapshot(repo):
    root = Path(repo).expanduser().resolve(strict=True)
    if not root.is_dir(): raise ValueError('Repository must be a directory')
    return {'name': root.name, 'path': str(root), 'revision': git(root, 'rev-parse', 'HEAD'), 'dirty': bool(git(root, 'status', '--porcelain')), 'snapshotId': str(uuid.uuid4()), 'capturedAt': datetime.now(timezone.utc).isoformat().replace('+00:00','Z'), 'fingerprint': fingerprint(root)}

def outside_repo(output, repo):
    if Path(output).resolve().is_relative_to(Path(repo).resolve()): raise ValueError('Output must be outside the analyzed repository')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('repo'); parser.add_argument('--output', required=True); args = parser.parse_args()
    value = snapshot(args.repo); outside_repo(args.output, value['path'])
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(value, indent=2)+'\n')
    print(f'Snapshot written: {output.resolve()}')
