"""OWNER-EXECUTED REMOTE WRITE. Preparation only: never run during local QA.
Reads the OG file only after an explicit switch; no secret in argv/output/repo.
"""
import json, os, pathlib, stat, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[2]
config = root / '.wrangler/og-staging-session/off.json'
if sys.argv[1:] != ['--owner-authorized-existing-worker']:
    raise SystemExit('Not executed. Requires future authorization and verified existing STAGING Worker/Access inventory.')
cfg = json.loads(config.read_text())
if cfg.get('name') != 'rlvo-share-links-staging' or cfg.get('vars', {}).get('SHARE_OG_ENABLED') != 'false' or not cfg.get('account_id'):
    raise SystemExit('Rejected STAGING configuration')
secret_file = pathlib.Path.home() / '.config/rlvo/secrets/staging-share-og-key-current.env'
fd = os.open(secret_file, os.O_RDONLY | os.O_NOFOLLOW)
try:
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
        raise SystemExit('Secret file must be owned by current user with no group/other permissions')
    data = os.read(fd, 4097)
finally:
    os.close(fd)
if len(data) > 4096:
    raise SystemExit('Rejected secret file')
lines = data.decode('ascii').splitlines()
if len(lines) != 1 or not lines[0].startswith('SHARE_OG_KEY_CURRENT='):
    raise SystemExit('Expected exactly one SHARE_OG_KEY_CURRENT assignment')
value = lines[0].split('=', 1)[1]
if not 32 <= len(value) <= 256 or any(ord(c) < 33 or ord(c) > 126 for c in value):
    raise SystemExit('Invalid secret format')
env = {**os.environ, 'CI':'true', 'WRANGLER_SEND_METRICS':'false', 'WRANGLER_SEND_ERROR_REPORTS':'false', 'WRANGLER_LOG':'none', 'CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV':'false', 'RLVO_OG_SECRET_GUARD_CONFIG':str(config)}
# Transport preload blocks implicit Worker creation and every other remote write.
result = subprocess.run(['node', '--require', str(root/'scripts/share-links/og-secret-transport.cjs'), str(root/'node_modules/wrangler/wrangler-dist/cli.js'), 'secret', 'put', 'SHARE_OG_KEY_CURRENT', '--config', str(config)], cwd=root, env=env, input=(value+'\n').encode(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
print('Secret operation completed.' if result.returncode == 0 else 'Secret operation failed; inspect metadata without printing credentials.')
raise SystemExit(result.returncode)
