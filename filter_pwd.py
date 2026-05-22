import subprocess, sys, os

files = ['apps/api/scripts/inspect_kv.ts', 'apps/api/scripts/migrate-kv-case.ts']
old = 'npg_4hHl1AMjTier'
new = 'REDACTED'

for f in files:
    try:
        r = subprocess.run(['git', 'show', f':{f}'], capture_output=True, text=True, timeout=10)
        if r.returncode != 0:
            continue
        content = r.stdout
        if old not in content:
            continue
        new_content = content.replace(old, new)
        blob = subprocess.run(['git', 'hash-object', '-w', '--stdin'],
                              input=new_content, capture_output=True, text=True, timeout=10)
        if blob.returncode != 0:
            continue
        h = blob.stdout.strip()
        subprocess.run(['git', 'update-index', '--add', '--cacheinfo', f'100644,{h},{f}'], timeout=10)
    except Exception as e:
        print(f'Failed on {f}: {e}', file=sys.stderr)
