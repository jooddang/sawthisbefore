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
      const owner = repository.owner?.login ?? repository.owner?.name ?? 'unknown';
      const repo = repository.name ?? 'unknown';
      if (action === 'opened' || action === 'edited' || action === 'reopened') {
        if (process.env.NO_DB === 'true' || (global as any).NO_DB === true) {
          await this.handleNoDbSimilarityFlow(p.installation?.id, owner, repo, issue);
        } else {
          await this.triage.upsertIssueFromGithub(owner, repo, {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            author: issue.user?.login ?? undefined,
          });
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
    for (const s of top) {
      const body = `Found similar issue: #${s.number} (score: ${s.score.toFixed(3)})`;
      await client.issues.createComment({ owner, repo, issue_number: targetIssue.number, body });
      // Optionally cross-comment on the similar issue about the target
      const backBody = `Related to #${targetIssue.number} (score: ${s.score.toFixed(3)})`;
      await client.issues.createComment({ owner, repo, issue_number: s.number, body: backBody });
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


