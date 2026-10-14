#!/usr/bin/env python3
"""Regression checks for report evidence, snapshots, and launch boundaries."""
import copy
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest
from make_demo import make_demo
from snapshot import snapshot, outside_repo
from validate_report import validate
from launch import choose_port

class ReportTests(unittest.TestCase):
    def setUp(self): self.report = make_demo()
    def test_exact_source_evidence(self): validate(self.report)
    def test_damaged_graph(self):
        report=copy.deepcopy(self.report); report['flows'][0]['edges'][0]['target']='missing'
        with self.assertRaisesRegex(ValueError,'endpoint'): validate(report)
    def test_invented_excerpt(self):
        report=copy.deepcopy(self.report); report['flows'][0]['nodes'][0]['evidence'][0]['excerpt']='invented code'
        with self.assertRaisesRegex(ValueError,'Excerpt'): validate(report)
    def test_outside_repo_evidence(self):
        report=copy.deepcopy(self.report); report['flows'][0]['nodes'][0]['evidence'][0]['file']='../secret.ts'
        with self.assertRaisesRegex(ValueError,'path'): validate(report)
    def test_stale_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'fixture'; shutil.copytree(self.report['repository']['path'], root)
            report=copy.deepcopy(self.report); report['repository']=snapshot(root)
            validate(report)
            (root/'new-feature.ts').write_text('export const value = 1;\n')
            with self.assertRaisesRegex(ValueError,'changed since analysis'): validate(report)
    def test_changed_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'fixture'; shutil.copytree(self.report['repository']['path'], root)
            report=copy.deepcopy(self.report); report['repository']=snapshot(root)
            with (root/'app/login/submit.ts').open('a') as file: file.write('// change\n')
            with self.assertRaisesRegex(ValueError,'Source changed'): validate(report)
    def test_php_backend_change_invalidates_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'fixture'; shutil.copytree(self.report['repository']['path'], root)
            backend=root/'controller.php'; backend.write_text('<?php return "queued";\n')
            report=copy.deepcopy(self.report); report['repository']=snapshot(root)
            validate(report)
            backend.write_text('<?php return "failed";\n')
            with self.assertRaisesRegex(ValueError,'changed since analysis'): validate(report)
    def test_outside_repo_symlink(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'fixture'; shutil.copytree(self.report['repository']['path'],root)
            outside=Path(temp)/'outside.ts'; outside.write_text('export const secret = 1;\n')
            source=root/'app/login/submit.ts'; source.unlink(); source.symlink_to(outside)
            report=copy.deepcopy(self.report); report['repository']=snapshot(root)
            with self.assertRaisesRegex(ValueError,'outside-repo'): validate(report)
    def test_output_boundary(self):
        with self.assertRaisesRegex(ValueError,'outside'): outside_repo(Path(self.report['repository']['path'])/'report.json',self.report['repository']['path'])
    def test_occupied_port(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
            self.assertNotEqual(choose_port(port),port)
    def test_no_findings_is_valid(self):
        report=copy.deepcopy(self.report); report['findings']=[]; validate(report)

class InstallTests(unittest.TestCase):
    def test_portable_install_excludes_local_files_and_preserves_existing_install(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'source package'
            root.mkdir()
            for name in ['.local', '.agents', '.codex', 'node_modules', '.next', 'coverage']:
                folder=root/name; folder.mkdir(); (folder/'private.txt').write_text('local-only')
            for name in ['.env', '.env.local', 'skills-lock.json', 'AGENTS.md', 'CLAUDE.md']:
                (root/name).write_text('local-only')
            (root/'SKILL.md').write_text('---\nname: godeyes\n---\n')
            scripts=root/'scripts'; scripts.mkdir()
            shutil.copyfile(Path(__file__).parent/'install.py', scripts/'install.py')
            viewer=root/'assets/viewer'; viewer.mkdir(parents=True)
            (viewer/'bun.lock').write_text('frozen lockfile')
            (viewer/'components.json').write_text('preset configuration')
            target=Path(temp)/'installed skills/godeyes'
            command=[sys.executable, str(scripts/'install.py'), '--destination', str(target)]
            installed=subprocess.run(command, cwd=temp, capture_output=True, text=True)
            self.assertEqual(installed.returncode, 0, installed.stderr)
            self.assertTrue((target/'SKILL.md').exists())
            self.assertEqual((target/'assets/viewer/bun.lock').read_text(), 'frozen lockfile')
            self.assertEqual((target/'assets/viewer/components.json').read_text(), 'preset configuration')
            for name in ['.local', '.agents', '.codex', 'node_modules', '.next', 'coverage', '.env', '.env.local', 'skills-lock.json', 'AGENTS.md', 'CLAUDE.md']:
                self.assertFalse((target/name).exists(), name)
            (target/'keep.txt').write_text('existing changes')
            repeated=subprocess.run(command, cwd=temp, capture_output=True, text=True)
            self.assertNotEqual(repeated.returncode, 0)
            self.assertEqual((target/'keep.txt').read_text(), 'existing changes')

if __name__ == '__main__': unittest.main()
