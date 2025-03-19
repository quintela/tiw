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

/**
 * File utility class for file operations
 */
export class FileUtils {
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
      // Create reviews directory if it doesn't exist
      if (!fs.existsSync(reviewsDir)) {
        fs.mkdirSync(reviewsDir, { recursive: true });
      }

      // Create a filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = path.join(reviewsDir, `review-${timestamp}.json`);

      // Combine metadata and feedback
      let parsedFeedback: object;
      try {
        // If the feedback is a string, parse it to an object
        parsedFeedback = typeof feedback === 'string' ? JSON.parse(feedback) : feedback;
      } catch (error) {
        console.error('Error parsing feedback JSON:', (error as Error).message);
        throw new Error('Could not parse feedback as JSON.');
      }

      const reviewData = {
        metadata,
        feedback: parsedFeedback,
      };

      // Write to file
      fs.writeFileSync(filename, JSON.stringify(reviewData, null, 2));
      console.log(`Review saved to ${filename}`);

      return filename;
    } catch (error) {
      console.error('Error saving review to file:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Load a directory of prompt files and combine them into a full prompt
   * @param promptDir - Directory containing the prompt files in markdown format
   * @returns The combined prompt template
   */
  loadPromptFromDirectory(promptDir: string): string {
    try {
      if (!fs.existsSync(promptDir)) {
        throw new Error(`Prompt directory not found: ${promptDir}`);
      }

      // Read all markdown files from the directory
      const files = fs
        .readdirSync(promptDir)
        .filter(file => file.endsWith('.md'))
        .sort(); // Sort to ensure consistent order

      if (files.length === 0) {
        // Fallback to best practices if no files present
        return this.getBestPracticesPrompt();
      }

      // Combine all files into a single prompt template
      let fullPrompt = '';
      for (const file of files) {
        const filePath = path.join(promptDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        fullPrompt += `${content}\n\n`;
      }

      return fullPrompt.trim();
    } catch (error) {
      console.error(
        `Error loading prompt template from directory ${promptDir}:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Load a formatter template from file
   * @param templatePath - Path to the formatter template file
   * @returns The formatter template
   */
  loadFormatterTemplate(templatePath: string): Handlebars.TemplateDelegate {
    try {
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Formatter template not found: ${templatePath}`);
      }

      const content = fs.readFileSync(templatePath, 'utf8');
      return Handlebars.compile(content);
    } catch (error) {
      console.error(
        `Error loading formatter template from ${templatePath}:`,
        (error as Error).message
      );
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
