import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { TriageService } from '../triage/triage.service';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [GithubModule],
  controllers: [WebhookController],
  providers: [WebhookService, PrismaService, EmbeddingService, TriageService],
})
export class WebhookModule {}


