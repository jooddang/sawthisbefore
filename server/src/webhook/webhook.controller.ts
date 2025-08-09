import { Body, Controller, Headers, HttpCode, Post, BadRequestException, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';

@Controller('ingest')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('github')
  @HttpCode(202)
  async handleGithubWebhook(
    @Headers('x-github-event') event: string,
    @Body() payload: unknown,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    // Minimal signature validation (sha256)
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const signature = (req.headers['x-hub-signature-256'] as string | undefined) ?? '';
    if (secret && signature.startsWith('sha256=')) {
      const h = createHmac('sha256', secret);
      const raw = (req as any).rawBody ?? JSON.stringify(payload);
      h.update(typeof raw === 'string' ? raw : Buffer.from(raw));
      const digest = `sha256=${h.digest('hex')}`;
      const ok = timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
      if (!ok) throw new BadRequestException('Invalid signature');
    }
    await this.webhookService.handleGithubEvent(event, payload);
    return { status: 'accepted' };
  }
}


