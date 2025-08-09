import 'dotenv/config';
import http from 'http';

function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<void> {
  const data = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'POST',
        host: 'localhost',
        port: Number(process.env.PORT) || 3000,
        path,
        headers: { 'content-type': 'application/json', 'content-length': data.length, ...headers },
      },
      (res) => {
        res.resume();
        res.on('end', resolve);
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const repoFull = process.env.GITHUB_REPO || 'jooddang/sawthisbefore';
  const [owner, name] = repoFull.split('/');
  const issueNumber = Number(process.env.ISSUE_NUMBER || 1);
  const payload = {
    action: 'opened',
    issue: { number: issueNumber, title: 'Crash on startup v1.8.2 on macOS 14.5', body: 'Stack trace ...', state: 'open', user: { login: owner } },
    repository: { name, owner: { login: owner } },
  };
  await post('/ingest/github', payload, { 'x-github-event': 'issues' });
  console.log('Simulated webhook delivered.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


