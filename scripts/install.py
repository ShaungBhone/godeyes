#!/usr/bin/env python3
"""Install this skill without dependencies, caches, or overwriting an existing skill."""
import argparse
from pathlib import Path
import shutil

INSTALL_EXCLUDES = (
    'node_modules', '.next', '.git', '.local', '.agents', '.codex',
    'AGENTS.md', 'CLAUDE.md', 'skills-lock.json', 'coverage', '*.tsbuildinfo', '__pycache__', '.DS_Store',
    'playwright-report', 'test-results', '.env', '.env.*',
)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, default=Path.home()/'.agents/skills/godeyes', help='Install directory (default: ~/.agents/skills/godeyes)')
    args=parser.parse_args(); source=Path(__file__).resolve().parent.parent; target=args.destination.expanduser().resolve()
    if target.exists(): parser.exit(1, f'An existing skill is present at {target}; it has not been overwritten.\n')
    if target.is_relative_to(source): parser.exit(1, 'Install destination must be outside the package.\n')
    shutil.copytree(source,target,ignore=shutil.ignore_patterns(*INSTALL_EXCLUDES))
    print(f'Installed godeyes: {target}')
