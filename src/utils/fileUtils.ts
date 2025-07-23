import fs from 'node:fs';
import path from 'node:path';

import Handlebars from 'handlebars';

export interface ReviewMetadata {
  timestamp: string;
  llmProvider: string;
  llmModel: string;
  mrMode: string;
  gitPlatform: string;
  commandLine: string;
  [key: string]: unknown;
}

interface ReviewData {
  metadata: ReviewMetadata;
  feedback: object;
}

/**
 * File utility class for file operations
 */
export class FileUtils {
  /**
   * Ensures a directory exists
   * @param dirPath - Directory path to ensure
   * @returns True if directory was created, false if it already existed
   * @throws If the directory cannot be created
   */
  private ensureDirectoryExists(dirPath: string): boolean {
    if (fs.existsSync(dirPath)) {
      return false;
    }

    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }

  /**
   * Generate a timestamped filename for a review
   * @param reviewsDir - Base directory for reviews
   * @returns Full path with timestamped filename
   */
  private generateReviewFilename(reviewsDir: string): string {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    return path.join(reviewsDir, `review-${timestamp}.json`);
  }

  /**
   * Parse feedback string to object if needed
   * @param feedback - Feedback as string or object
   * @returns Parsed feedback as object
   * @throws If feedback string cannot be parsed as JSON
   */
  private parseFeedback(feedback: string | object): object {
    if (typeof feedback !== 'string') {
      return feedback;
    }

    try {
      return JSON.parse(feedback);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Create a fallback structured response when JSON parsing fails
      const fallbackResponse = {
        overview: {
          summary: "Code review completed but response was not in expected JSON format",
          riskLevel: "medium",
          recommendedAction: "comment"
        },
        fileReviews: [],
        testReview: {
          compliance: "unknown",
          missingTests: ["Unable to parse test analysis from response"],
          testQualityIssues: []
        },
        generalFeedback: {
          strengths: [],
          concerns: ["LLM response was not in valid JSON format"],
          suggestions: [
            "Review the raw response manually",
            "Consider adjusting the prompt to enforce JSON output"
          ]
        },
        rawResponse: feedback.substring(0, 1000) // Include first 1000 chars of raw response
      };
      
      console.warn(`Warning: Could not parse LLM response as JSON: ${errorMessage}`);
      console.warn(`Raw response (first 200 chars): ${feedback.substring(0, 200)}...`);
      
      return fallbackResponse;
    }
  }

  /**
   * Create review data object from metadata and feedback
   * @param metadata - Review metadata
   * @param parsedFeedback - Parsed feedback object
   * @returns Combined review data object
   */
  private createReviewData(metadata: ReviewMetadata, parsedFeedback: object): ReviewData {
    return {
      metadata,
      feedback: parsedFeedback,
    };
  }

  /**
   * Write review data to file
   * @param filePath - Path to write the file
   * @param reviewData - Review data to write
   * @throws If the file cannot be written
   */
  private writeReviewFile(filePath: string, reviewData: ReviewData): void {
    fs.writeFileSync(filePath, JSON.stringify(reviewData, null, 2));
  }

  /**
   * Save review data to a JSON file
   * @param reviewsDir - Directory to save reviews
   * @param feedback - The feedback to save
   * @param metadata - Metadata about the review
   * @returns The path where the review was saved
   * @throws If the review dir cannot be created or the file cannot be written
   */
  saveReviewToFile(
    reviewsDir: string,
    feedback: string | object,
    metadata: ReviewMetadata
  ): string {
    try {
      this.ensureDirectoryExists(reviewsDir);

      const filePath = this.generateReviewFilename(reviewsDir);
      const parsedFeedback = this.parseFeedback(feedback);
      const reviewData = this.createReviewData(metadata, parsedFeedback);

      this.writeReviewFile(filePath, reviewData);

      console.log(`Review saved to ${filePath}`);
      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving review to file:', errorMessage);
      throw error;
    }
  }

  /**
   * Get all markdown files from a directory
   * @param promptDir - Directory to search for markdown files
   * @returns Sorted array of markdown filenames
   * @throws If the directory cannot be read
   */
  private getMarkdownFiles(promptDir: string): string[] {
    return fs
      .readdirSync(promptDir)
      .filter(file => file.endsWith('.md'))
      .sort(); // Sort to ensure consistent order
  }

  /**
   * Read file content and return as string
   * @param filePath - Path to file
   * @returns File content as string
   * @throws If file cannot be read
   */
  private readFileContent(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Combine multiple file contents into a single string
   * @param promptDir - Directory containing files
   * @param files - Array of filenames to combine
   * @returns Combined content
   */
  private combineFileContents(promptDir: string, files: string[]): string {
    let fullPrompt = '';

    for (const file of files) {
      const filePath = path.join(promptDir, file);
      const content = this.readFileContent(filePath);
      fullPrompt += `${content}\n\n`;
    }

    return fullPrompt.trim();
  }

  /**
   * Validate prompt directory exists
   * @param promptDir - Directory path to validate
   * @throws If directory doesn't exist
   */
  private validatePromptDirectory(promptDir: string): void {
    if (!fs.existsSync(promptDir)) {
      throw new Error(`Prompt directory not found: ${promptDir}`);
    }
  }

  /**
   * Load a directory of prompt files and combine them into a full prompt
   * @param promptDir - Directory containing the prompt files in markdown format
   * @returns The combined prompt template
   */
  loadPromptFromDirectory(promptDir: string): string {
    try {
      this.validatePromptDirectory(promptDir);

      const files = this.getMarkdownFiles(promptDir);

      if (files.length === 0) {
        return this.getBestPracticesPrompt();
      }

      return this.combineFileContents(promptDir, files);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error loading prompt template from directory ${promptDir}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Validate formatter template file exists
   * @param templatePath - Path to validate
   * @throws If file doesn't exist
   */
  private validateTemplateExists(templatePath: string): void {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Formatter template not found: ${templatePath}`);
    }
  }

  /**
   * Compile Handlebars template from content
   * @param content - Template content
   * @returns Compiled Handlebars template
   */
  private compileTemplate(content: string): Handlebars.TemplateDelegate {
    return Handlebars.compile(content);
  }

  /**
   * Load a formatter template from file
   * @param templatePath - Path to the formatter template file
   * @returns The formatter template
   */
  loadFormatterTemplate(templatePath: string): Handlebars.TemplateDelegate {
    try {
      this.validateTemplateExists(templatePath);

      const content = this.readFileContent(templatePath);
      return this.compileTemplate(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error loading formatter template from ${templatePath}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Get a fallback prompt if no files are found
   * @returns A default best practices prompt
   */
  private getBestPracticesPrompt(): string {
    return `Review this code pull request and provide a detailed analysis focusing on:
1. Logical errors and bugs
2. Security vulnerabilities
3. Performance issues
4. Maintainability concerns

Please evaluate according to best practices for the language and framework in use.
Provide specific feedback with line numbers when possible.

Structure your response in JSON format for easier parsing.

CODE DIFF:
{{diff}}`;
  }
}
