import 'dotenv/config';
import { GithubService } from '../src/github/github.service';

async function main() {
  const installationIdEnv = process.env.GITHUB_INSTALLATION_ID;
  const ownerRepo = process.env.GITHUB_REPO || 'jooddang/sawthisbefore';
  const appId = process.env.GITHUB_APP_ID;
  const pk = process.env.GITHUB_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY_BASE64;
  if (!installationIdEnv) {
    console.error('Set GITHUB_INSTALLATION_ID to target installation');
    process.exit(1);
  }
  if (!appId || !pk) {
    console.error('Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY (or GITHUB_PRIVATE_KEY_BASE64) in .env');
    process.exit(1);
  }
  const installationId = Number(installationIdEnv);
  const [owner, repo] = ownerRepo.split('/');
  const svc = new GithubService();

  const samples = [
    { title: 'Crash on startup (Gemini test)', body: 'After update, crash occurs. Stack trace ...' },
    { title: 'UI glitch in header (Gemini test)', body: 'Avatar click throws error. Steps ...' },
    { title: 'Crash on startup v1.8.2 on macOS 14.5', body: 'After updating to v1.8.2, app crashes at launch. Stack trace: ...' },
    { title: 'UI: Avatar click causes exception', body: 'Clicking the avatar in header crashes UI. Repro steps: ...' },
    { title: 'exceptions on Avatar click', body: 'avatar click throws exception. ui is broken. ' },
    { title: 'CLI build fails on Node 20', body: 'Running cli build fails with ESM error on Node v20.11.0' },
  ];
  for (const s of samples) {
    const issue = await svc.createIssueWithApp(installationId, owner, repo, s.title, s.body);
    console.log(`Created via App: #${issue.number}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


