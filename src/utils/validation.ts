/**
 * Validation utilities for input validation
 */
export class Validation {
  /**
   * Check if a string is a valid URL
   * @param url - The URL to validate
   * @returns True if URL is valid
   */
  isValidUrl(url: unknown): boolean {
    if (typeof url !== 'string') {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch (/* eslint-disable-line @typescript-eslint/no-unused-vars, no-unused-vars */ _error) {
      return false;
    }
  }

  /**
   * Check if a value is a non-empty string
   * @param value - The value to check
   * @returns True if value is a non-empty string
   */
  isNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Check if a value is one of the allowed options
   * @param value - The value to check
   * @param allowedOptions - List of allowed options
   * @returns True if value is in allowedOptions
   */
  isAllowedOption<T>(value: unknown, allowedOptions: readonly T[]): boolean {
    return allowedOptions.includes(value as T);
  }
}
