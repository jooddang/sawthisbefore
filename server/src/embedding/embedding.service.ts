import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor() {}

  async embedText(text: string, model = process.env.EMBEDDINGS_MODEL ?? 'text-embedding-004'): Promise<number[]> {
    if (!process.env.GOOGLE_API_KEY) {
      this.logger.warn('GOOGLE_API_KEY not set; returning zero-vector');
      return new Array(768).fill(0);
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model });
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      title: 'issue',
    } as any);
    const vector = (result?.embedding?.values ?? []) as unknown as number[];
    return vector;
  }
}


