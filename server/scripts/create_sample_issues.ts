import 'dotenv/config';
import { Octokit } from '@octokit/rest';

async function main() {
  const repo = process.env.GITHUB_REPO || 'jooddang/sawthisbefore';
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN is required (repo scope). Export it and re-run.');
    process.exit(1);
  }
  const [owner, repoName] = repo.split('/');
  const octokit = new Octokit({ auth: token });

  const samples = [
    { title: 'Crash on startup v1.8.2 on macOS 14.5', body: 'After updating to v1.8.2, app crashes at launch. Stack trace: ...' },
    { title: 'UI: Avatar click causes exception', body: 'Clicking the avatar in header crashes UI. Repro steps: ...' },
    { title: 'exceptions on Avatar click', body: 'avatar click throws exception. ui is broken. ' },
    { title: 'CLI build fails on Node 20', body: 'Running cli build fails with ESM error on Node v20.11.0' },
  ];

  for (const s of samples) {
    try {
      const res = await octokit.issues.create({ owner, repo: repoName, title: s.title, body: s.body });
      console.log(`Created issue #${res.data.number}: ${res.data.title}`);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const msg = err?.message ?? err?.response?.data?.message;
      console.error(`Failed to create issue '${s.title}' [status=${status}]: ${msg}`);
      if (err?.response?.data) {
        console.error(JSON.stringify(err.response.data));
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


