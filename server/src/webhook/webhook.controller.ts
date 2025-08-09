import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('ingest')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('github')
  @HttpCode(202)
  async handleGithubWebhook(
    @Headers('x-github-event') event: string,
    @Body() payload: unknown,
  ): Promise<{ status: string }> {
    await this.webhookService.handleGithubEvent(event, payload);
    return { status: 'accepted' };
  }
}


