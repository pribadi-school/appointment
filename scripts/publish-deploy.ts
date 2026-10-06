/**
 * Builds the app and publishes dist/ to the `deploy` branch on GitHub.
 * cPanel (Git™ Version Control) pulls that branch and its .cpanel.yml copies
 * the files into public_html/report.
 * Run: npm run deploy
 */
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BRANCH = 'deploy';
const DEPLOY_PATH = '/home/pribadisch/public_html/report/';

const CPANEL_YML = `---
deployment:
  tasks:
    - export DEPLOYPATH=${DEPLOY_PATH}
    - /bin/mkdir -p $DEPLOYPATH
    - /bin/rm -rf $DEPLOYPATH/assets
    - /bin/cp -R ./* ./.htaccess $DEPLOYPATH
`;

const git = (args: string[], cwd = '.') => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// Built with empty Supabase keys, the live site silently runs in demo mode.
const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!process.env[key] && !m?.[1].trim()) fail(`${key} is empty in .env — the live site would run in demo mode.`);
}

if (git(['status', '--porcelain'])) fail('You have uncommitted changes. Commit (and push) them first, so the live site matches GitHub.');

const sha = git(['rev-parse', '--short', 'HEAD']);
const subject = git(['log', '-1', '--format=%s']);

execSync('npm run build', { stdio: 'inherit' });

const hasRemote = git(['ls-remote', '--heads', 'origin', BRANCH]) !== '';
if (hasRemote) git(['fetch', 'origin', BRANCH]);

const dir = mkdtempSync(join(tmpdir(), 'ptc-deploy-'));
try {
  git(hasRemote ? ['worktree', 'add', '-B', BRANCH, dir, `origin/${BRANCH}`] : ['worktree', 'add', '--orphan', '-b', BRANCH, dir]);

  // Replace everything with the fresh build (keep the worktree's .git file).
  for (const f of readdirSync(dir)) if (f !== '.git') rmSync(join(dir, f), { recursive: true, force: true });
  cpSync('dist', dir, { recursive: true });
  writeFileSync(join(dir, '.cpanel.yml'), CPANEL_YML);

  git(['add', '-A'], dir);
  if (!git(['status', '--porcelain'], dir)) {
    console.log(`\nNothing changed — the ${BRANCH} branch already has this build.\n`);
  } else {
    git(['commit', '-m', `Build of ${sha}: ${subject}`], dir);
    execFileSync('git', ['push', 'origin', BRANCH], { cwd: dir, stdio: 'inherit' });
    console.log(`\n✓ Pushed build of ${sha} to the ${BRANCH} branch.`);
    console.log('  Now in cPanel → Git™ Version Control → Manage → Pull or Deploy:');
    console.log('  "Update from Remote", then "Deploy HEAD Commit".\n');
  }
} finally {
  git(['worktree', 'remove', '--force', dir]);
}
