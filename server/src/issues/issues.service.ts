import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class IssuesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTriageSuggestion(issueNumber: number) {
    const issue = await this.prisma.issue.findFirst({
      where: { number: issueNumber },
      include: { suggestions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue.suggestions[0] ?? null;
  }

  async applySuggestion(issueNumber: number) {
    const suggestion = await this.getTriageSuggestion(issueNumber);
    if (!suggestion) throw new NotFoundException('No suggestion to apply');
    // v0: no-op apply; v1: call GitHub APIs to apply labels/assignees
    await this.prisma.decisionLog.create({
      data: {
        issue: { connect: { id: (await this.prisma.issue.findFirstOrThrow({ where: { number: issueNumber } })).id } },
        action: 'APPLY_SUGGESTION',
        actor: 'system',
        payload: JSON.parse(JSON.stringify(suggestion)) as unknown as any,
      },
    });
    return { applied: true };
  }
}


