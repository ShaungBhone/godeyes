#!/usr/bin/env python3
"""Launch a report in an isolated, loopback-only Next.js viewer."""
import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
from validate_report import load_report
from snapshot import outside_repo

def choose_port(start=3000):
    for port in range(start, min(start+100, 65536)):
        with socket.socket() as sock:
            try: sock.bind(('127.0.0.1', port)); return port
            except OSError: pass
    raise ValueError('No available localhost port in the requested range')

def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('report'); parser.add_argument('--runtime', required=True); parser.add_argument('--port', type=int, default=3000); args = parser.parse_args()
    report_path = Path(args.report).expanduser().resolve(); report = load_report(report_path)
    runtime = Path(args.runtime).expanduser().resolve(); outside_repo(runtime, report['repository']['path'])
    source = Path(__file__).resolve().parent.parent / 'assets/viewer'
    if runtime == source or runtime.is_relative_to(source): raise ValueError('Runtime must be separate from the skill template')
    marker = runtime / '.repo-flow-runtime'
    if runtime.exists() and any(runtime.iterdir()) and not marker.exists(): raise ValueError('Runtime directory contains unrelated files; choose an empty directory')
    require_bun = shutil.which('bun')
    if not require_bun: raise ValueError('Bun is required. Install Bun, then rerun this launcher.')
    shutil.copytree(source, runtime, dirs_exist_ok=True, ignore=shutil.ignore_patterns('node_modules', '.next', '.git', '*.tsbuildinfo', 'playwright-report', 'test-results', '.DS_Store', '__pycache__'))
    marker.write_text('godeyes runtime\n')
    subprocess.run([require_bun, 'install', '--frozen-lockfile'], cwd=runtime, check=True)
    subprocess.run([require_bun, 'run', 'scripts/check-report.ts', str(report_path)], cwd=runtime, check=True)
    port = choose_port(args.port)
    print(f'\nGodEyes: http://127.0.0.1:{port}\nReport: {report_path}\nStop with Ctrl+C.\n', flush=True)
    env = {**os.environ, 'REPO_FLOW_REPORT': str(report_path), 'NEXT_TELEMETRY_DISABLED': '1'}
    process = subprocess.Popen([require_bun, 'run', 'dev', '--hostname', '127.0.0.1', '--port', str(port)], cwd=runtime, env=env)
    try: return process.wait()
    except KeyboardInterrupt:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill(); process.wait()
        return 0

if __name__ == '__main__':
    try: raise SystemExit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as error: raise SystemExit(f'Launch failed: {error}')
