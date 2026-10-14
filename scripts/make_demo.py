#!/usr/bin/env python3
"""Generate the source-backed demonstration report without executing its fixture."""
import argparse
import hashlib
import json
from pathlib import Path
from snapshot import snapshot, outside_repo

def make_demo():
    root = Path(__file__).resolve().parent.parent / 'assets/viewer/tests/fixture'
    repo = snapshot(root); repo['name'] = 'Login demo · fixture'
    ui = 'app/login/submit.ts'; api = 'app/api/login/route.ts'
    def cite(file, start, end):
        raw = (root / file).read_bytes()
        return {'file': file, 'startLine': start, 'endLine': end, 'excerpt': '\n'.join(raw.decode().splitlines()[start-1:end]), 'fileHash': hashlib.sha256(raw).hexdigest()}
    def node(id, title, description, kind, symbol, file, start, end, confidence='confirmed'):
        return {'id': id, 'title': title, 'description': description, 'kind': kind, 'symbol': symbol, 'confidence': confidence, 'evidence': [cite(file,start,end)]}
    nodes = [
        node('submit','Submit login','The user submits email and password to the login handler.','entry','submitLogin()',ui,2,3),
        node('validate','Check required fields','Both email and password must be present before calling the API.','decision','email && password',ui,3,3),
        node('validation-error','Show validation error','Missing credentials return the validation-error screen immediately.','outcome','validation-error',ui,3,3),
        node('api','Send login request','POST credentials to /api/login. The server also checks required fields.','action','POST /api/login',api,2,7),
        node('provider','Check external identity','The route sends credentials to an external service. Its implementation is unavailable.','external','identity.example.test',api,8,10,'unresolved'),
        node('check','Check provider response','A successful HTTP response is treated as authenticated; every other HTTP status becomes 401.','decision','identity.ok',api,11,14),
        node('reject','Show login error','A rejected request returns login-error to the user.','outcome','login-error',ui,8,8),
        node('dashboard','Open dashboard screen','A successful API response opens the dashboard. No session is established in the traced code.','outcome','dashboard',ui,9,9),
        node('unavailable','Return service error','The server catches provider errors and returns HTTP 503.','action','HTTP 503',api,15,17),
        node('network-error','Show network error','A rejected browser fetch returns the network-error screen.','outcome','network-error',ui,10,11),
    ]
    def edge(source,target,label,file,start,end,branch='normal',confidence='confirmed'):
        return {'id': f'{source}-{target}', 'source': source, 'target': target, 'label': label, 'branch': branch, 'confidence': confidence, 'evidence': [cite(file,start,end)]}
    edges = [
        edge('submit','validate','Submit credentials',ui,2,3),
        edge('validate','validation-error','Missing field',ui,3,3,'false'),
        edge('validate','api','Both fields present',ui,3,7,'true'),
        edge('api','provider','Await identity response',api,8,10),
        edge('provider','check','HTTP response received',api,8,14),
        edge('check','reject','Non-success status',api,11,12,'false'),
        edge('check','dashboard','Success status',ui,8,9,'true'),
        edge('provider','unavailable','Provider request throws',api,8,17,'error'),
        edge('unavailable','reject','API returns 503',ui,8,8,'error'),
        edge('api','network-error','Browser fetch throws',ui,4,11,'error'),
    ]
    nodes[3]['evidence'].append(cite(ui,5,7))
    next(e for e in edges if e['id']=='check-reject')['evidence'].append(cite(ui,8,8))
    next(e for e in edges if e['id']=='check-dashboard')['evidence'].append(cite(api,14,14))
    next(e for e in edges if e['id']=='unavailable-reject')['evidence'].append(cite(api,15,17))
    findings = [
        {'id':'missing-session','flowId':'login','nodeIds':['dashboard','check'],'title':'Success does not establish a login session','severity':'high','trigger':'The identity service returns a successful response and the API returns authenticated: true.','impact':'The client switches to the dashboard, but the traced implementation sets no session cookie or token. Subsequent requests have no authentication credential from this flow.','suggestion':'Verify the provider response, create a server-side session, and set an appropriate HTTP-only session cookie before returning success.','evidence':[cite(api,11,14),cite(ui,8,9)]},
        {'id':'provider-status','flowId':'login','nodeIds':['check','reject'],'title':'Provider outages are reported as invalid credentials','severity':'medium','trigger':'The identity service responds with HTTP 429 or 5xx instead of throwing.','impact':'The server returns 401 Invalid credentials for every non-success response, hiding an upstream outage and misleading the user.','suggestion':'Handle explicit credential rejection separately from rate limits and provider failures, preserving a service-unavailable outcome.','evidence':[cite(api,11,12)]},
    ]
    return {'schemaVersion':1,'repository':repo,'overview':{'summary':'A small Next.js-style login fixture used to demonstrate static flow analysis and code review. It is source material, not a running authentication app.','stack':['TypeScript','Next.js route handler','Fetch API'],'entryPoints':[{'label':'Login form submission','evidence':[cite(ui,2,12)]},{'label':'POST /api/login','evidence':[cite(api,2,18)]}]},'flows':[{'id':'login','title':'Login flow','description':'From credential submission to the dashboard, including validation and service failures.','nodes':nodes,'edges':edges}],'findings':findings,'limitations':['Demonstration fixture only; the reviewed application is not executed.','The external identity provider implementation and response contract are unavailable.','Dashboard rendering, session middleware, and production deployment settings are outside the provided fixture.']}

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--output',required=True); args=parser.parse_args()
    report=make_demo(); outside_repo(args.output,report['repository']['path']); path=Path(args.output); path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(report,indent=2)+'\n'); print(f'Demo report: {path.resolve()}')
