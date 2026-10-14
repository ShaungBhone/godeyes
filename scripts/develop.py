#!/usr/bin/env python3
"""Develop the viewer directly from project source, using a static demo by default."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
from launch import choose_port
from make_demo import make_demo
from validate_report import load_report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--port', type=int, default=3000)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    bun = shutil.which('bun')
    if not bun: parser.exit(1, 'Bun is required. Install Bun and run bun run setup.\n')
    if args.report:
        report_path = args.report.expanduser().resolve()
    else:
        report_path = root / '.local/demo-report.json'
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(make_demo(), indent=2) + '\n')
    load_report(report_path)
    viewer = root / 'assets/viewer'
    if not (viewer / 'node_modules').exists():
        subprocess.run([bun, 'install', '--frozen-lockfile'], cwd=viewer, check=True)
    subprocess.run([bun, 'run', 'scripts/check-report.ts', str(report_path)], cwd=viewer, check=True)
    port = choose_port(args.port)
    print(f'\nGodEyes: http://127.0.0.1:{port}\nViewer source: {viewer}\n', flush=True)
    env = {**os.environ, 'REPO_FLOW_REPORT': str(report_path), 'NEXT_TELEMETRY_DISABLED': '1'}
    child = subprocess.Popen([bun, 'run', 'dev', '--hostname', '127.0.0.1', '--port', str(port)], cwd=viewer, env=env)
    try: return child.wait()
    except KeyboardInterrupt:
        child.terminate()
        try: child.wait(timeout=10)
        except subprocess.TimeoutExpired: child.kill(); child.wait()
        return 0

if __name__ == '__main__':
    try: raise SystemExit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as error: raise SystemExit(f'Development launch failed: {error}')
