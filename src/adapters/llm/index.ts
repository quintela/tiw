import type { AppConfig } from '../../config/config';
import { AnthropicAdapter } from './AnthropicAdapter';
import { CopilotAdapter } from './CopilotAdapter';
import { DeepSeekAdapter } from './DeepSeekAdapter';
import { LLMAdapter } from './LLMAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';

/**
 * Factory for creating LLM adapters
 */
export class LLMAdapterFactory {
  /**
   * Create a new LLM adapter based on configuration
   * @param config - The configuration object
   * @returns The appropriate LLM adapter
   * @throws If provider is unsupported
   */
  create(config: AppConfig): LLMAdapter {
    const provider = config.llmProvider.toLowerCase();

    switch (provider) {
      case 'anthropic':
        return new AnthropicAdapter(config);
      case 'openai':
        return new OpenAIAdapter(config);
      case 'deepseek':
        return new DeepSeekAdapter(config);
      case 'copilot':
        return new CopilotAdapter(config);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}

export { LLMAdapter };
