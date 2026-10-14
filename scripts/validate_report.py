#!/usr/bin/env python3
"""Validate report structure, graph references, and exact source evidence."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
from snapshot import allowed, fingerprint, git, outside_repo

def require(condition, message):
    if not condition: raise ValueError(message)

def text(value, label): require(isinstance(value, str) and bool(value.strip()), f'{label} must be nonempty text')
def array(value, label): require(isinstance(value, list), f'{label} must be an array')
def unique(items, label):
    ids = []
    for item in items:
        require(isinstance(item, dict), f'{label} item must be an object'); text(item.get('id'), f'{label}.id'); ids.append(item['id'])
    require(len(set(ids)) == len(ids), f'{label} has duplicate IDs')

def validate(report, check_sources=True):
    require(isinstance(report, dict) and type(report.get('schemaVersion')) is int and report['schemaVersion'] == 1, 'Unsupported report schema version')
    repo = report.get('repository'); require(isinstance(repo, dict), 'Missing repository')
    for key in ('name', 'path', 'snapshotId', 'capturedAt', 'fingerprint'): text(repo.get(key), f'repository.{key}')
    require(Path(repo['path']).is_absolute(), 'repository.path must be absolute')
    require(repo.get('revision') is None or isinstance(repo['revision'], str), 'Invalid revision')
    require(type(repo.get('dirty')) is bool, 'dirty must be boolean')
    require(re.fullmatch('[a-f0-9]{64}', repo['fingerprint']), 'Invalid fingerprint')
    when = datetime.fromisoformat(repo['capturedAt'].replace('Z', '+00:00')); require(when.tzinfo is not None, 'Timestamp requires timezone')
    root = Path(repo['path']).resolve(); checked_files = {}

    def evidence(items, required=False):
        array(items, 'evidence'); require(not required or bool(items), 'Confirmed behavior and findings require evidence')
        for item in items:
            require(isinstance(item, dict), 'Evidence must be an object')
            for key in ('file', 'excerpt', 'fileHash'): text(item.get(key), f'evidence.{key}')
            rel = Path(item['file']); require(not rel.is_absolute() and '..' not in rel.parts and '\\' not in item['file'] and allowed(rel), 'Invalid or excluded evidence path')
            start, end = item.get('startLine'), item.get('endLine')
            require(type(start) is int and type(end) is int and 0 < start <= end, 'Invalid source range')
            require(re.fullmatch('[a-f0-9]{64}', item['fileHash']), 'Invalid file hash')
            if check_sources:
                file = (root / rel).resolve(); require(file.is_relative_to(root) and file.is_file(), f'Missing or outside-repo source: {rel}')
                if file not in checked_files:
                    raw = file.read_bytes(); checked_files[file] = (hashlib.sha256(raw).hexdigest(), raw.decode('utf8').splitlines())
                digest, lines = checked_files[file]
                require(digest == item['fileHash'], f'Source changed: {rel}')
                require(end <= len(lines), f'Source range exceeds file: {rel}')
                require('\n'.join(lines[start-1:end]) == item['excerpt'], f'Excerpt does not match source: {rel}:{start}')

    overview = report.get('overview'); require(isinstance(overview, dict), 'Missing overview'); text(overview.get('summary'), 'overview.summary')
    array(overview.get('stack'), 'stack')
    for item in overview['stack']: text(item, 'stack item')
    array(overview.get('entryPoints'), 'entryPoints')
    for entry in overview['entryPoints']:
        require(isinstance(entry, dict), 'Invalid entry point'); text(entry.get('label'), 'entry label'); evidence(entry.get('evidence'), True)
    flows = report.get('flows'); array(flows, 'flows'); require(bool(flows), 'At least one flow is required'); unique(flows, 'flows')
    flow_nodes = {}
    for flow in flows:
        for key in ('title', 'description'): text(flow.get(key), f'flow.{key}')
        array(flow.get('nodes'), 'nodes'); require(bool(flow['nodes']), 'Flow needs at least one node'); unique(flow['nodes'], 'nodes')
        array(flow.get('edges'), 'edges'); unique(flow['edges'], 'edges')
        ids = {node['id'] for node in flow['nodes']}; flow_nodes[flow['id']] = ids
        for node in flow['nodes']:
            for key in ('title', 'description', 'symbol'): text(node.get(key), f'node.{key}')
            require(node.get('kind') in {'entry','action','decision','external','outcome'}, 'Invalid node kind')
            require(node.get('confidence') in {'confirmed','inferred','unresolved'}, 'Invalid node confidence'); evidence(node.get('evidence'), node['confidence'] == 'confirmed')
        for edge in flow['edges']:
            text(edge.get('label'), 'edge.label'); require(edge.get('source') in ids and edge.get('target') in ids, 'Missing edge endpoint')
            require(edge.get('branch') in {'normal','true','false','error'}, 'Invalid branch')
            require(edge.get('confidence') in {'confirmed','inferred','unresolved'}, 'Invalid edge confidence'); evidence(edge.get('evidence'), edge['confidence'] == 'confirmed')
    findings = report.get('findings'); array(findings, 'findings'); unique(findings, 'findings')
    for finding in findings:
        for key in ('title', 'trigger', 'impact', 'suggestion', 'flowId'): text(finding.get(key), f'finding.{key}')
        require(finding.get('severity') in {'high','medium','low'}, 'Invalid severity')
        array(finding.get('nodeIds'), 'finding.nodeIds'); require(bool(finding['nodeIds']) and all(isinstance(n, str) and n in flow_nodes.get(finding['flowId'], set()) for n in finding['nodeIds']), 'Finding references missing flow or node')
        evidence(finding.get('evidence'), True)
    array(report.get('limitations'), 'limitations')
    for item in report['limitations']: text(item, 'limitation')
    if check_sources:
        require(root.is_dir(), 'Repository no longer exists')
        require(fingerprint(root) == repo['fingerprint'], 'Repository source changed since analysis; regenerate the report')
        require(git(root, 'rev-parse', 'HEAD') == repo['revision'], 'Git revision changed since analysis')
    return report

def load_report(path):
    value = json.loads(Path(path).read_text()); validate(value); outside_repo(path, value['repository']['path']); return value

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('report'); args = parser.parse_args()
    try:
        value = load_report(args.report); print(f"Valid report: {len(value['flows'])} flow(s), {len(value['findings'])} finding(s); source evidence verified")
    except (ValueError, OSError, KeyError, TypeError) as error: parser.exit(1, f'Invalid report: {error}\n')
