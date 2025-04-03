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
    return this.getProviderTokenLimit(this.config.llmProvider);
  }

  /**
   * Get token limit for specific provider
   * @param provider - The LLM provider name
   * @returns The token limit for the specified provider
   */
  private getProviderTokenLimit(provider: string): number {
    const providerLimits: Record<string, number> = {
      anthropic: this.config.anthropicMaxTokens,
      openai: this.config.openaiMaxTokens,
      deepseek: this.config.deepseekMaxTokens,
      copilot: this.config.copilotMaxTokens,
    };

    return providerLimits[provider] || this.config.maxPromptTokens;
  }

  /**
   * Trims whitespace from text while preserving meaningful content
   * @param text - Text to trim
   * @returns Trimmed text
   */
  trimText(text: string | undefined): string {
    if (!text) {
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

  /**
   * Split a prompt into multiple parts if it exceeds the token limit
   * @param prompt - The prompt to split
   * @returns An array of prompt parts
   */
  splitPrompt(prompt: string): string[] {
    // Check if prompt has markers and needs splitting
    if (!this.hasValidMarkers(prompt) || this.isWithinTokenLimit(prompt)) {
      return [prompt];
    }

    // Extract sections based on markers
    const { intro, outro } = this.extractMarkedSections(prompt);
    const parts = this.splitContentAtContinuationMarkers(prompt);

    // Combine parts with intro and outro
    return this.combineSplitParts(parts, intro, outro);
  }

  /**
   * Check if prompt has valid intro and outro markers
   * @param prompt - The prompt to check
   * @returns Whether prompt has valid markers
   */
  private hasValidMarkers(prompt: string): boolean {
    return prompt.includes(this.splitMarkers.intro) && prompt.includes(this.splitMarkers.outro);
  }

  /**
   * Check if prompt is within token limit
   * @param prompt - The prompt to check
   * @returns Whether prompt is within limit
   */
  private isWithinTokenLimit(prompt: string): boolean {
    return this.estimateTokenCount(prompt) <= this.getMaxTokenLimit();
  }

  /**
   * Extract intro and outro sections from prompt
   * @param prompt - The prompt with markers
   * @returns Object containing intro and outro text
   */
  private extractMarkedSections(prompt: string): { intro: string; outro: string } {
    const introMatch = prompt.match(
      new RegExp(
        `${this.splitMarkers.intro}([\\s\\S]*?)(?=${this.splitMarkers.continuation}|${this.splitMarkers.outro})`
      )
    );
    const outroMatch = prompt.match(new RegExp(`${this.splitMarkers.outro}([\\s\\S]*)$`));

    return {
      intro: introMatch ? this.trimText(introMatch[1]) : '',
      outro: outroMatch ? this.trimText(outroMatch[1]) : '',
    };
  }

  /**
   * Split the main content at continuation markers
   * @param prompt - The full prompt
   * @returns Array of content parts
   */
  private splitContentAtContinuationMarkers(prompt: string): string[] {
    // Get the main content (everything between intro and outro)
    const mainContent = prompt
      .replace(
        new RegExp(`${this.splitMarkers.intro}[\\s\\S]*?(?=${this.splitMarkers.continuation})`),
        ''
      )
      .replace(new RegExp(`${this.splitMarkers.outro}[\\s\\S]*$`), '');

    // Split main content at continuation markers
    return mainContent.split(this.splitMarkers.continuation);
  }

  /**
   * Combine split parts with intro and outro
   * @param parts - Array of content parts
   * @param intro - Intro section text
   * @param outro - Outro section text
   * @returns Array of complete prompts
   */
  private combineSplitParts(parts: string[], intro: string, outro: string): string[] {
    return parts.map((part, index) => {
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
    return responses.join('\n');
  }

  /**
   * Rough estimation of token count (not perfect but good enough for safety checks)
   * @param text - The text to estimate token count for
   * @returns Estimated number of tokens
   */
  estimateTokenCount(text: string): number {
    // A simple approximation: 4 characters per token
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
      const promptParts = this.splitPrompt(trimmedPrompt);

      if (promptParts.length > 1) {
        this.logger.debug(`Prompt split into ${promptParts.length} parts due to token limit`);
        return await this.handleMultiPartRequest(promptParts);
      }

      // Standard single request
      return await this.sendRequest(promptParts[0] || '');
    } catch (error) {
      this.logger.error(`Error analyzing code: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Handle multiple request parts sequentially
   * @param promptParts - Array of prompt parts
   * @returns Combined response
   */
  private async handleMultiPartRequest(promptParts: string[]): Promise<string> {
    const responses: string[] = [];

    for (let i = 0; i < promptParts.length; i++) {
      this.logger.debug(`Sending part ${i + 1} of ${promptParts.length}`);
      const part = promptParts[i] || '';
      const response = await this.sendRequest(part);
      responses.push(response);
    }

    return this.mergeResponses(responses);
  }

  /**
   * Apply trimming to a prompt while preserving sections marked by special markers
   * @param prompt The prompt to trim
   * @returns The trimmed prompt with markers preserved
   */
  private applyTrimming(prompt: string): string {
    // Check if prompt has markers for splitting
    if (!this.hasValidMarkers(prompt)) {
      return this.trimText(prompt);
    }

    return this.trimWithMarkersPreserved(prompt);
  }

  /**
   * Trim text while preserving marker sections
   * @param prompt - The prompt with markers
   * @returns Trimmed prompt with preserved markers
   */
  private trimWithMarkersPreserved(prompt: string): string {
    // Extract all marker positions
    const markerPositions = this.findAllMarkerPositions(prompt);

    // Process each section between markers
    const parts = [];
    let currentIdx = 0;

    for (const marker of markerPositions) {
      // Add text before marker (trimmed)
      if (currentIdx < marker.pos) {
        const beforeMarker = prompt.substring(currentIdx, marker.pos);
        parts.push(this.trimText(beforeMarker));
      }

      // Add the marker itself
      parts.push(this.getMarkerByType(marker.type));

      // Move past the marker
      currentIdx = marker.pos + this.getMarkerByType(marker.type).length;
    }

    // Add any remaining text after the last marker
    if (currentIdx < prompt.length) {
      const afterMarkers = prompt.substring(currentIdx);
      parts.push(this.trimText(afterMarkers));
    }

    return parts.join('');
  }

  /**
   * Find all marker positions in the prompt
   * @param prompt - The prompt to search in
   * @returns Array of marker positions and types
   */
  private findAllMarkerPositions(prompt: string): Array<{ pos: number; type: string }> {
    // Find all marker positions
    const introIndex = prompt.indexOf(this.splitMarkers.intro);
    const outroIndex = prompt.indexOf(this.splitMarkers.outro);
    const continuationIndices = this.findAllContinuationMarkers(prompt);

    // Sort all marker positions
    return [
      { pos: introIndex, type: 'intro' },
      { pos: outroIndex, type: 'outro' },
      ...continuationIndices.map(pos => ({ pos, type: 'continuation' })),
    ]
      .sort((a, b) => a.pos - b.pos)
      .filter(m => m.pos !== -1);
  }

  /**
   * Find all continuation marker positions
   * @param prompt - The prompt to search in
   * @returns Array of positions
   */
  private findAllContinuationMarkers(prompt: string): number[] {
    const indices = [];
    let contIndex = prompt.indexOf(this.splitMarkers.continuation);

    while (contIndex !== -1) {
      indices.push(contIndex);
      contIndex = prompt.indexOf(this.splitMarkers.continuation, contIndex + 1);
    }

    return indices;
  }

  /**
   * Get marker string by type
   * @param type - The marker type
   * @returns Marker string
   */
  private getMarkerByType(type: string): string {
    const markerMap: Record<string, string> = {
      intro: this.splitMarkers.intro,
      outro: this.splitMarkers.outro,
      continuation: this.splitMarkers.continuation,
    };

    return markerMap[type] || '';
  }

  /**
   * Send a request to the LLM
   * @param prompt - The prompt to send
   * @returns The response from the LLM
   */
  // eslint-disable-next-line no-unused-vars
  abstract sendRequest(prompt: string): Promise<string>;

  /**
   * Process the LLM response into a consistent format
   * @param response - The raw response from the LLM
   * @returns The processed response
   */
  processResponse(response: string): string {
    // Try to extract JSON from code blocks first
    const extractedJson = this.extractJsonFromCodeBlocks(response);
    if (extractedJson) {
      return extractedJson;
    }

    // Try to parse as direct JSON
    return this.parseAsDirectJson(response);
  }

  /**
   * Extract JSON from code blocks
   * @param response - LLM response text
   * @returns JSON string or null if not valid
   */
  private extractJsonFromCodeBlocks(response: string): string | null {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!jsonMatch || !jsonMatch[1]) {
      return null;
    }

    try {
      const parsedJson = JSON.parse(jsonMatch[1].trim());
      return JSON.stringify(parsedJson);
    } catch (parseError) {
      this.logger.warn(
        `Found JSON-like content but it could not be parsed: ${(parseError as Error).message}`
      );
      return null;
    }
  }

  /**
   * Parse response as direct JSON
   * @param response - LLM response text
   * @returns Parsed JSON or original text
   */
  private parseAsDirectJson(response: string): string {
    try {
      const parsed = JSON.parse(response);
      return JSON.stringify(parsed);
    } catch (error) {
      this.logger.warn(`Response is not valid JSON, returning as plain text ${error}`);
      return response;
    }
  }
}
