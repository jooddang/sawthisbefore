import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TriageService } from '../triage/triage.service';
import { GithubService } from '../github/github.service';
import { EmbeddingService } from '../embedding/embedding.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly triage: TriageService,
    private readonly github: GithubService,
    private readonly embedding: EmbeddingService,
  ) {}

  async handleGithubEvent(event: string, payload: unknown): Promise<void> {
    this.logger.log(`Received GitHub event: ${event}`);
    if (event === 'issues') {
      const p = payload as any;
      const action = p?.action as string | undefined;
      const issue = p?.issue as any;
      const repository = p?.repository as any;
      if (!issue || !repository) return;
      this.logger.log(
        `issues action=${action} repo=${repository?.full_name ?? `${repository?.owner?.login}/${repository?.name}`} issue=#${issue?.number}`,
      );
      const owner = repository.owner?.login ?? repository.owner?.name ?? 'unknown';
      const repo = repository.name ?? 'unknown';
      if (action === 'opened' || action === 'edited' || action === 'reopened') {
        if (process.env.NO_DB === 'true' || (global as any).NO_DB === true) {
          this.logger.log('NO_DB mode: running similarity/comment flow');
          const installationId = (p.installation?.id ?? Number(process.env.GITHUB_INSTALLATION_ID ?? 0)) || undefined;
          await this.handleNoDbSimilarityFlow(installationId, owner, repo, issue);
        } else {
          this.logger.log('DB mode: upserting issue and computing similarities');
          await this.triage.upsertIssueFromGithub(owner, repo, {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            author: issue.user?.login ?? undefined,
          }, p.installation?.id ?? Number(process.env.GITHUB_INSTALLATION_ID ?? 0));
        }
      }
    }
  }

  private async handleNoDbSimilarityFlow(installationId: number | undefined, owner: string, repo: string, targetIssue: any) {
    this.logger.log('NO_DB mode active: fetching recent issues and commenting on similar ones');
    const client = await this.github.getInstallationClient(Number(installationId ?? 0));
    if (!client) {
      this.logger.warn('GitHub App not configured; skipping NO_DB flow');
      return;
    }
    // Fetch recent issues (excluding PRs)
    const listRes = await client.issues.listForRepo({ owner, repo, state: 'open', per_page: 50, sort: 'created', direction: 'desc' });
    const issues = listRes.data.filter((i) => !i.pull_request);
    this.logger.log(`Fetched ${issues.length} open issues for similarity check`);
    const targetText = `${targetIssue.title}\n\n${targetIssue.body ?? ''}`.slice(0, 8000);
    const targetVec = await this.embedding.embedText(targetText);
    type Scored = { number: number; id: number; title: string; body?: string | null; score: number };
    const scored: Scored[] = [];
    for (const i of issues) {
      if (i.number === targetIssue.number) continue;
      const text = `${i.title}\n\n${i.body ?? ''}`.slice(0, 8000);
      const vec = await this.embedding.embedText(text);
      const score = cosineSimilarity(targetVec, vec);
      scored.push({ number: i.number, id: i.id, title: i.title, body: i.body, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3).filter((s) => s.score > 0);
    this.logger.log(
      `Top similar: ${top.map((s) => `#${s.number}:${s.score.toFixed(3)}`).join(', ') || '(none > 0)'}`,
    );
    if (top.length > 0) {
      const list = top.map((s) => `- #${s.number} (score: ${s.score.toFixed(3)})`).join('\n');
      const body = `Similar issues detected:\n${list}`;
      await client.issues.createComment({ owner, repo, issue_number: targetIssue.number, body });
      this.logger.log(`Commented on #${targetIssue.number}: ${body}`);
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}


