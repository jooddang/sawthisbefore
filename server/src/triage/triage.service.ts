import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';

@Injectable()
export class TriageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async upsertIssueFromGithub(repoOwner: string, repoName: string, ghIssue: { number: number; title: string; body?: string | null; state?: string; author?: string | null; }): Promise<string> {
    const repo = await this.prisma.repoInstallation.upsert({
      where: { owner_repo: { owner: repoOwner, repo: repoName } },
      update: {},
      create: { owner: repoOwner, repo: repoName, installationId: BigInt(0) },
      select: { id: true },
    });
    const issue = await this.prisma.issue.upsert({
      where: { repoId_number: { repoId: repo.id, number: ghIssue.number } },
      update: { title: ghIssue.title, body: ghIssue.body ?? undefined, state: ghIssue.state ?? 'open', author: ghIssue.author ?? undefined },
      create: { repoId: repo.id, number: ghIssue.number, title: ghIssue.title, body: ghIssue.body ?? undefined, state: ghIssue.state ?? 'open', author: ghIssue.author ?? undefined },
      select: { id: true, title: true, body: true },
    });

    const text = `${issue.title}\n\n${issue.body ?? ''}`.slice(0, 8000);
    const vector = await this.embedding.embedText(text);
    await this.prisma.issueEmbedding.create({ data: { issueId: issue.id, vector, model: process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-large' } });

    // Naive similarity: cosine using SQL on float8[] is non-trivial; fetch last 50 embeddings in app and compute
    const recent = await this.prisma.issueEmbedding.findMany({
      where: { issueId: { not: issue.id } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { issue: true },
    });
    const scores = recent.map((e) => ({ id: e.issueId, score: cosineSimilarity(vector, e.vector as unknown as number[]), issue: e.issue }));
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, 3);
    for (const s of top) {
      await this.prisma.similarLink.upsert({
        where: { issueId_similarIssueId: { issueId: issue.id, similarIssueId: s.id } },
        update: { score: s.score },
        create: { issueId: issue.id, similarIssueId: s.id, score: s.score },
      } as unknown as Prisma.SimilarLinkUpsertArgs);
    }

    // Store a minimal triage suggestion (labels/assignees empty initially)
    await this.prisma.triageSuggestion.create({
      data: {
        issueId: issue.id,
        labels: [],
        assignees: [],
        priorityScore: 0,
        confidenceJson: { retrieval: { k: top.length } } as unknown as Prisma.InputJsonValue,
        rationale: 'Initial retrieval only',
      },
    });

    return issue.id;
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


