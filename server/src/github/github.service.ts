import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

function getPrivateKey(): string | undefined {
  const b64 = process.env.GITHUB_PRIVATE_KEY_BASE64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf8');
  return process.env.GITHUB_PRIVATE_KEY;
}

@Injectable()
export class GithubService {
  private buildInstallationClient(installationId: number): Octokit | undefined {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = getPrivateKey();
    if (!appId || !privateKey) return undefined;
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId,
      },
    });
  }

  async getInstallationClient(installationId: number): Promise<Octokit | undefined> {
    return this.buildInstallationClient(installationId);
  }

  async createIssueWithApp(installationId: number, owner: string, repo: string, title: string, body?: string) {
    const client = this.buildInstallationClient(installationId);
    if (!client) throw new Error('GitHub App not configured');
    const res = await client.issues.create({ owner, repo, title, body });
    return res.data;
  }
}


