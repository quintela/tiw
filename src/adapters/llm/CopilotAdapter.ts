import axios from 'axios';

import { LLMAdapter } from './LLMAdapter';

/**
 * Adapter for GitHub Copilot API
 */
export class CopilotAdapter extends LLMAdapter {
  private readonly apiEndpoint = 'https://api.githubcopilot.com/chat/completions';

  /**
   * Initialize the Copilot client
   * @returns The initialized API configuration
   */
  initClient(): { apiKey: string; endpoint: string } {
    if (!this.config.copilotApiKey) {
      throw new Error('GitHub Copilot API key is required');
    }

    return {
      apiKey: this.config.copilotApiKey,
      endpoint: this.apiEndpoint,
    };
  }

  /**
   * Send a request to GitHub Copilot
   * @param prompt - The prompt including the code to analyze
   * @returns The Copilot response
   */
  override async sendRequest(prompt: string): Promise<string> {
    try {
      const client = this.initClient();

      this.logger.debug(
        `Sending request to GitHub Copilot using model ${this.config.copilotModel}`
      );

      const response = await axios.post(
        client.endpoint,
        {
          model: this.config.copilotModel,
          messages: [
            { role: 'system', content: 'You are an expert code reviewer from GitHub Copilot.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 4000,
          temperature: 0.1,
        },
        {
          headers: {
            Authorization: `Bearer ${client.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'GitHub-Copilot',
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

      throw new Error('Invalid response from GitHub Copilot API');
    } catch (error) {
      this.logger.error(`Error calling GitHub Copilot API: ${(error as Error).message}`);
      throw error;
    }
  }
}
