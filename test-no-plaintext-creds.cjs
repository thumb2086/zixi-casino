/* 靜態驗證：env 守衛必須在建立連線之前，而且 env 檔沒被追蹤 */
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const ZC = 'C:/Users/CPXru/Desktop/thumb/大拇哥實驗室/地球在線合併/zixi-casino';

let pass = 0, fail = 0;
const check = (n, c, d) => { if (c) { pass++; console.log('  OK   ' + n); } else { fail++; console.log('  FAIL ' + n + (d ? '\n         ' + d : '')); } };

const FILES = ['apps/api/scripts/check_keys.mjs', 'apps/api/scripts/migrate-kv-case.ts'];

for (const f of FILES) {
  console.log('\n=== ' + f + ' ===');
  const s = fs.readFileSync(path.join(ZC, f), 'utf8');

  const iGuard = s.indexOf('if (!url)');
  /* ★ 精準匹配「真正使用 url 的地方」。
     我第一版寫成 /postgres\(url|new Redis|url\)/ —— 那個 url\) 分支
     匹配到的是守衛自己的 if (!url)，於是 iUse 指向守衛而非使用點，
     讓「process.exit 在使用之前」這條永遠失敗。
     程式碼本身是對的，是斷言寫錯了。 */
  const iUse = s.indexOf('postgres(url');
  const iExit = s.indexOf('process.exit(1)');

  check('★ 有 env 守衛 if (!url)', iGuard >= 0);
  check('★ 守衛在使用 url 之前', iGuard >= 0 && iUse > iGuard, 'guard=' + iGuard + ' use=' + iUse);
  check('★ 守衛裡有 process.exit(1)', iExit > iGuard && iExit < iUse, 'exit=' + iExit + ' guard=' + iGuard + ' use=' + iUse);
  check('從 DATABASE_URL 讀取', /process\.env\.DATABASE_URL/.test(s));
  check('★ 沒有任何 pg_ 密碼殘留', !/npg_[A-Za-z0-9]{8,}/.test(s));
  check('★ 沒有真實 Neon 主機名殘留', !/ep-[a-z0-9]{6,}\./i.test(s));
  check('★ 沒有 postgres://user:realpass@ 的硬寫 DSN',
    !/postgres(?:ql)?:\/\/(?!USER:|PASSWORD:|user:pass)[^'"\s:]+:[^'"\s]+@/.test(s));
  check('有說明為什麼改成 env', /2026-10-17/.test(s));
  check('括號平衡（粗略）', (s.match(/\{/g) || []).length === (s.match(/\}/g) || []).length,
    '{=' + (s.match(/\{/g) || []).length + ' }=' + (s.match(/\}/g) || []).length);
}

/* .mjs 可以用 node --check 真正驗證語法 */
console.log('\n=== node --check（.mjs 是 ESM，可驗證）===');
{
  const r = spawnSync(process.execPath, ['--check', path.join(ZC, 'apps/api/scripts/check_keys.mjs')],
    { encoding: 'utf8', shell: false, windowsHide: true });
  check('check_keys.mjs 語法', r.status === 0, (r.stderr || '').split('\n').slice(0, 4).join(' '));
}

console.log('\n=== filter_pwd.py 已移除 ===');
check('檔案不存在', !fs.existsSync(path.join(ZC, 'filter_pwd.py')));
{
  const tracked = execFileSync('git', ['ls-files'], { cwd: ZC, encoding: 'utf8', shell: false, windowsHide: true }).split('\n');
  check('不再被 git 追蹤', !tracked.includes('filter_pwd.py'));
}

console.log('\n=== env 檔追蹤狀態 ===');
{
  const tracked = execFileSync('git', ['ls-files'], { cwd: ZC, encoding: 'utf8', shell: false, windowsHide: true }).split('\n').filter(Boolean);
  const envTracked = tracked.filter((x) => /(^|\/)\.env(\.|$)/i.test(x) && x !== '.env.example');
  check('★ 沒有任何 .env* 被追蹤（.env.example 除外）', envTracked.length === 0, envTracked.join(', '));
  check('.env.example 有被準備追蹤', tracked.includes('.env.example') || fs.existsSync(path.join(ZC, '.env.example')));
  check('.gitignore 有 !.env.example 例外', /!\.env\.example/.test(fs.readFileSync(path.join(ZC, '.gitignore'), 'utf8')));
}

console.log('\n=== 全域複掃：被追蹤檔案裡還有沒有 DB 密碼 ===');
{
  const tracked = execFileSync('git', ['ls-files'], { cwd: ZC, encoding: 'utf8', shell: false, windowsHide: true }).split('\n').filter(Boolean);
  let pgHits = 0, hostHits = 0;
  const files = [];
  for (const rel of tracked) {
    let s;
    try { s = fs.readFileSync(path.join(ZC, rel), 'utf8'); } catch { continue; }
    if (/npg_[A-Za-z0-9]{8,}/.test(s)) { pgHits++; files.push(rel + ' (npg_)'); }
    if (/ep-[a-z0-9]{6,}\.[a-z0-9-]+\.(aws\.neon\.tech|neon\.tech)/i.test(s)) { hostHits++; files.push(rel + ' (host)'); }
  }
  check('★ 沒有任何 npg_ 密碼', pgHits === 0, files.join(', '));
  check('★ 沒有任何真實 Neon 主機名', hostHits === 0, files.join(', '));
}

console.log('\n=== ' + pass + ' 通過 / ' + fail + ' 失敗 ===');
process.exit(fail ? 1 : 0);