import OpenAI from 'openai';

import { LLMAdapter } from './LLMAdapter';

/**
 * Adapter for OpenAI's GPT models
 */
export class OpenAIAdapter extends LLMAdapter {
  declare protected client: OpenAI;

  /**
   * Initialize the OpenAI client
   * @returns The initialized OpenAI client
   */
  initClient(): OpenAI {
    if (!this.client) {
      if (!this.config.openaiApiKey) {
        throw new Error('OpenAI API key is required');
      }

      this.client = new OpenAI({
        apiKey: this.config.openaiApiKey,
      });
    }

    return this.client;
  }

  /**
   * Send a request to OpenAI's models
   * @param prompt - The prompt including the code to analyze
   * @returns The OpenAI response
   */
  override async sendRequest(prompt: string): Promise<string> {
    try {
      const client = this.initClient();

      this.logger.debug(`Sending request to OpenAI using model ${this.config.openaiModel}`);

      const response = await client.chat.completions.create({
        model: this.config.openaiModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content || '';
      return this.processResponse(content);
    } catch (error) {
      this.logger.error(`Error calling OpenAI API: ${(error as Error).message}`);
      throw error;
    }
  }
}
