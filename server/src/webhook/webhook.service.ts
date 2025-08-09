import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TriageService } from '../triage/triage.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService, private readonly triage: TriageService) {}

  async handleGithubEvent(event: string, payload: unknown): Promise<void> {
    this.logger.log(`Received GitHub event: ${event}`);
    if (event === 'issues') {
      const p = payload as any;
      const action = p?.action as string | undefined;
      const issue = p?.issue as any;
      const repository = p?.repository as any;
      if (!issue || !repository) return;
      if (action === 'opened' || action === 'edited' || action === 'reopened') {
        await this.triage.upsertIssueFromGithub(
          repository.owner?.login ?? repository.owner?.name ?? 'unknown',
          repository.name ?? 'unknown',
          {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            author: issue.user?.login ?? undefined,
          },
        );
      }
    }
  }
}


