import path from 'node:path';

import type { TemplateDelegate } from 'handlebars';

import { FileUtils } from '../utils/fileUtils';

export interface ReviewComment {
  line: number;
  type: string;
  severity: string;
  comment: string;
  suggestion?: string;
}

export interface FileReview {
  file: string;
  comments: ReviewComment[];
}

export interface TestQualityIssue {
  file: string;
  line: number;
  issue: string;
  suggestion: string;
}

export interface TestReview {
  compliance: string;
  missingTests: string[];
  testQualityIssues: TestQualityIssue[];
}

export interface Overview {
  summary: string;
  riskLevel: string;
  recommendedAction: string;
}

export interface GeneralFeedback {
  strengths: string[];
  concerns: string[];
  suggestions: string[];
}

export interface ReviewFeedback {
  overview: Overview;
  fileReviews: FileReview[];
  testReview: TestReview;
  generalFeedback: GeneralFeedback;
}

export interface ReviewData {
  metadata: Record<string, unknown>;
  feedback: ReviewFeedback;
}

/**
 * Formats review data for output
 */
export class ReviewFormatter {
  private fileUtils: FileUtils;
  private templatePath: string;
  private template: TemplateDelegate;

  /**
   * Create a new ReviewFormatter
   * @param templatePath - Path to the template file (defaults to markdown template)
   */
  constructor(templatePath?: string) {
    this.fileUtils = new FileUtils();
    this.templatePath =
      templatePath || path.join(__dirname, '..', 'templates', 'formatters', 'markdown_format.md');
    this.template = this.fileUtils.loadFormatterTemplate(this.templatePath);
  }

  /**
   * Format a review using the selected template
   * @param reviewData - The parsed review data
   * @returns Formatted content based on the template
   */
  format(reviewData: ReviewData): string {
    try {
      return this.template(reviewData.feedback);
    } catch (error) {
      console.error('Error formatting review:', (error as Error).message);
      return 'Error formatting review. Please check the review file for details.';
    }
  }
}
