import Anthropic from '@anthropic-ai/sdk';

import { LLMAdapter } from './LLMAdapter';

/**
 * Adapter for Anthropic's Claude LLM
 */
export class AnthropicAdapter extends LLMAdapter {
  declare protected client: Anthropic;

  /**
   * Initialize the Anthropic client
   * @returns The initialized Anthropic client
   */
  initClient(): Anthropic {
    if (!this.client) {
      if (!this.config.anthropicApiKey) {
        throw new Error('Anthropic API key is required');
      }

      this.client = new Anthropic({
        apiKey: this.config.anthropicApiKey,
      });
    }

    return this.client;
  }

  /**
   * Send a request to Anthropic's Claude
   * @param prompt - The prompt including the code to analyze
   * @returns The Claude response
   */
  async sendRequest(prompt: string): Promise<string> {
    try {
      const client = this.initClient();

      this.logger.debug(`Sending request to Anthropic using model ${this.config.anthropicModel}`);

      const message = await client.messages.create({
        model: this.config.anthropicModel,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0]?.text || '';
      return this.processResponse(responseText);
    } catch (error) {
      this.logger.error(`Error calling Anthropic API: ${(error as Error).message}`);
      throw error;
    }
  }
}
