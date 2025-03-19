import axios from 'axios';

import { LLMAdapter } from './LLMAdapter';

/**
 * Adapter for DeepSeek CodeLLM
 */
export class DeepSeekAdapter extends LLMAdapter {
  private readonly apiEndpoint = 'https://api.deepseek.com/v1/chat/completions';

  /**
   * Initialize the DeepSeek client
   * @returns The initialized API configuration
   */
  initClient(): { apiKey: string; endpoint: string } {
    if (!this.config.deepseekApiKey) {
      throw new Error('DeepSeek API key is required');
    }

    return {
      apiKey: this.config.deepseekApiKey,
      endpoint: this.apiEndpoint,
    };
  }

  /**
   * Send a request to DeepSeek Coder
   * @param prompt - The prompt including the code to analyze
   * @returns The DeepSeek response
   */
  override async sendRequest(prompt: string): Promise<string> {
    try {
      const client = this.initClient();

      this.logger.debug(`Sending request to DeepSeek using model ${this.config.deepseekModel}`);

      const response = await axios.post(
        client.endpoint,
        {
          model: this.config.deepseekModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000,
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${client.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (
        response.data &&
        response.data.choices &&
        response.data.choices.length > 0 &&
        response.data.choices[0].message
      ) {
        return this.processResponse(response.data.choices[0].message.content);
      }

      throw new Error('Invalid response from DeepSeek API');
    } catch (error) {
      this.logger.error(`Error calling DeepSeek API: ${(error as Error).message}`);
      throw error;
    }
  }
}
