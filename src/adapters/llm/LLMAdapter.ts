import type { AppConfig } from '../../config/config';
import { Logger } from '../../utils/logging';

/**
 * Split markers used to identify parts of the prompt that should be preserved
 * when splitting into multiple requests
 */
export interface SplitMarkers {
  intro: string;
  outro: string;
  continuation: string;
}

/**
 * Base abstract class for LLM adapters
 * Defines the interface that all LLM adapters must implement
 */
export abstract class LLMAdapter {
  protected config: AppConfig;
  protected client?: unknown;
  protected logger: Logger;
  protected splitMarkers: SplitMarkers = {
    intro: '<!-- INTRO -->',
    outro: '<!-- OUTRO -->',
    continuation: '<!-- CONTINUATION -->',
  };

  /**
   * Create a new LLM adapter
   * @param config - The configuration for the LLM
   */
  constructor(config: AppConfig) {
    if (this.constructor === LLMAdapter) {
      throw new Error('LLMAdapter is an abstract class and cannot be instantiated directly');
    }

    this.config = config;
    this.logger = new Logger(config.verbose || false);
  }

  /**
   * Initialize the LLM client
   * @returns The initialized client
   */
  abstract initClient(): unknown;

  /**
   * Get the maximum token limit for the current provider
   * @returns The maximum number of tokens allowed in a prompt
   */
  getMaxTokenLimit(): number {
    switch (this.config.llmProvider) {
      case 'anthropic':
        return this.config.anthropicMaxTokens;
      case 'openai':
        return this.config.openaiMaxTokens;
      case 'deepseek':
        return this.config.deepseekMaxTokens;
      case 'copilot':
        return this.config.copilotMaxTokens;
      default:
        return this.config.maxPromptTokens;
    }
  }

  /**
   * Split a prompt into multiple parts if it exceeds the token limit
   * @param prompt - The prompt to split
   * @returns An array of prompt parts
   */
  /**
   * Trims whitespace from text while preserving meaningful content
   * @param text - Text to trim
   * @returns Trimmed text
   */
  trimText(text: string | undefined): string {
    if (text === undefined) {
      return '';
    }

    // Trim leading/trailing whitespace
    let trimmed = text.trim();

    // Replace multiple consecutive whitespace with a single space
    trimmed = trimmed.replace(/\s+/g, ' ');

    // Replace multiple consecutive newlines with a single newline
    trimmed = trimmed.replace(/\n\s*\n\s*\n+/g, '\n\n');

    return trimmed;
  }

  splitPrompt(prompt: string): string[] {
    // Check if prompt has markers for splitting
    const hasMarkers =
      prompt.includes(this.splitMarkers.intro) && prompt.includes(this.splitMarkers.outro);

    // If no markers or prompt is under the limit, return as is with trimming
    if (!hasMarkers || this.estimateTokenCount(prompt) <= this.getMaxTokenLimit()) {
      return [prompt];
    }

    // Extract intro and outro based on markers
    const introMatch = prompt.match(
      new RegExp(
        `${this.splitMarkers.intro}([\\s\\S]*?)(?=${this.splitMarkers.continuation}|${this.splitMarkers.outro})`
      )
    );
    const outroMatch = prompt.match(new RegExp(`${this.splitMarkers.outro}([\\s\\S]*)$`));

    // Trim the intro and outro text while preserving the content
    const intro = introMatch ? this.trimText(introMatch[1]) : '';
    const outro = outroMatch ? this.trimText(outroMatch[1]) : '';

    // Get the main content (everything between intro and outro)
    const mainContent = prompt
      .replace(
        new RegExp(`${this.splitMarkers.intro}[\\s\\S]*?(?=${this.splitMarkers.continuation})`),
        ''
      )
      .replace(new RegExp(`${this.splitMarkers.outro}[\\s\\S]*$`), '');

    // Split main content at continuation markers
    const parts = mainContent.split(this.splitMarkers.continuation);

    // Combine parts with intro and outro to make complete prompts, with trimming applied
    return parts.map((part, index) => {
      // Trim each part
      const trimmedPart = this.trimText(part);

      if (index === 0) {
        // First part gets intro + part
        return `${this.splitMarkers.intro}${intro}${trimmedPart}`;
      }
      if (index === parts.length - 1) {
        // Last part gets part + outro
        return `${trimmedPart}${this.splitMarkers.outro}${outro}`;
      }
      // Middle parts just get the part itself
      return trimmedPart;
    });
  }

  /**
   * Merge multiple responses into a single response
   * @param responses - Array of responses from LLM
   * @returns Merged response
   */
  mergeResponses(responses: string[]): string {
    // For now, just concatenate the responses
    // In a real implementation, you might want to deduplicate or process them more intelligently
    return responses.join('\n');
  }

  /**
   * Rough estimation of token count (not perfect but good enough for safety checks)
   * @param text - The text to estimate token count for
   * @returns Estimated number of tokens
   */
  estimateTokenCount(text: string): number {
    // A simple approximation: 4 characters per token
    // This is a very rough estimate, but it's better than nothing
    return Math.ceil(text.length / 4);
  }

  /**
   * Analyze code with the LLM, handling large prompts by splitting if necessary
   * @param prompt - The prompt to send to the LLM
   * @returns The response from the LLM
   */
  async analyzeCode(prompt: string): Promise<string> {
    try {
      // Apply basic trimming to the full prompt to reduce size before splitting
      const trimmedPrompt = this.applyTrimming(prompt);
      const promptParts = this.splitPrompt(trimmedPrompt) || [];

      if (promptParts.length > 1) {
        this.logger.debug(`Prompt split into ${promptParts.length} parts due to token limit`);
      }

      if (promptParts.length === 1) {
        // Standard single request
        return await this.sendRequest(promptParts[0] || '');
      }
      // Multiple requests needed
      const responses: string[] = [];

      for (let i = 0; i < promptParts.length; i++) {
        this.logger.debug(`Sending part ${i + 1} of ${promptParts.length}`);
        const part = promptParts[i] || ''; // Ensure part is never undefined
        const response = await this.sendRequest(part);
        responses.push(response);
      }

      return this.mergeResponses(responses);
    } catch (error) {
      this.logger.error(`Error analyzing code: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Apply trimming to a prompt while preserving sections marked by special markers
   * @param prompt The prompt to trim
   * @returns The trimmed prompt with markers preserved
   */
  private applyTrimming(prompt: string): string {
    // Check if prompt has markers for splitting
    const hasMarkers =
      prompt.includes(this.splitMarkers.intro) && prompt.includes(this.splitMarkers.outro);

    // If no markers, trim the whole prompt
    if (!hasMarkers) {
      return this.trimText(prompt);
    }

    // Extract sections based on markers
    const parts = [];
    let currentIdx = 0;

    // Find all marker positions
    const introIndex = prompt.indexOf(this.splitMarkers.intro);
    const outroIndex = prompt.indexOf(this.splitMarkers.outro);
    const continuationIndices = [];
    let contIndex = prompt.indexOf(this.splitMarkers.continuation);
    while (contIndex !== -1) {
      continuationIndices.push(contIndex);
      contIndex = prompt.indexOf(this.splitMarkers.continuation, contIndex + 1);
    }

    // Sort all marker positions
    const allMarkers = [
      { pos: introIndex, type: 'intro' },
      { pos: outroIndex, type: 'outro' },
      ...continuationIndices.map(pos => ({ pos, type: 'continuation' })),
    ]
      .sort((a, b) => a.pos - b.pos)
      .filter(m => m.pos !== -1);

    // Process each section between markers
    for (let i = 0; i < allMarkers.length; i++) {
      const marker = allMarkers[i];

      if (!marker) {
        continue;
      } // Skip if marker is undefined

      // Removed unused variable
      // Add text before marker (trimmed)
      if (currentIdx < marker.pos) {
        const beforeMarker = prompt.substring(currentIdx, marker.pos);
        parts.push(this.trimText(beforeMarker));
      }

      // Add the marker itself
      if (marker.type === 'intro') {
        parts.push(this.splitMarkers.intro);
      } else if (marker.type === 'outro') {
        parts.push(this.splitMarkers.outro);
      } else if (marker.type === 'continuation') {
        parts.push(this.splitMarkers.continuation);
      }

      // Move past the marker
      currentIdx =
        marker.pos +
        (marker.type === 'intro'
          ? this.splitMarkers.intro.length
          : marker.type === 'outro'
            ? this.splitMarkers.outro.length
            : this.splitMarkers.continuation.length);
    }

    // Add any remaining text after the last marker
    if (currentIdx < prompt.length) {
      const afterMarkers = prompt.substring(currentIdx);
      parts.push(this.trimText(afterMarkers));
    }

    return parts.join('');
  }

  /**
   * Send a request to the LLM
   * @param prompt - The prompt to send
   * @returns The response from the LLM
   */
  /* eslint-disable-next-line no-unused-vars */
  abstract sendRequest(_prompt: string): Promise<string>;

  /**
   * Process the LLM response into a consistent format
   * @param response - The raw response from the LLM
   * @returns The processed response
   */
  processResponse(response: string): string {
    // Process response to ensure it's JSON-safe
    // If it starts with ```json and ends with ```, extract the JSON part
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        // Validate that it's proper JSON by parsing and stringifying
        const parsedJson = JSON.parse(jsonMatch[1].trim());
        return JSON.stringify(parsedJson);
      } catch (parseError) {
        this.logger.warn(
          `Found JSON-like content but it could not be parsed: ${(parseError as Error).message}`
        );
        // Continue to use the original response
      }
    }

    // If we didn't successfully extract and parse JSON, try returning the raw response
    try {
      // Try to parse as JSON directly (in case it's already clean JSON)
      const parsed = JSON.parse(response);
      return JSON.stringify(parsed);
    } catch (/* eslint-disable-line @typescript-eslint/no-unused-vars, no-unused-vars */ _error) {
      // Not valid JSON, return as-is and let the caller handle it
      this.logger.warn('Response is not valid JSON, returning as plain text');
      return response;
    }
  }
}
