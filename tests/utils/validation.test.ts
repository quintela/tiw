import { describe, expect, it, jest } from '@jest/globals';

import * as path from 'path';

import { Validation } from '../../src/utils/validation';

// Generate a mock instance of Validation for testing
const mockValidation = {
  isValidUrl: jest.fn(),
  isNonEmptyString: jest.fn(),
  isAllowedOption: jest.fn(),
};

// Directly test the methods without a class instance
describe('Validation', () => {
  const validation = new Validation();

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(validation.isValidUrl('https://gitlab.com/group/project')).toBe(true);
      expect(validation.isValidUrl('http://github.com/user/repo')).toBe(true);
      expect(validation.isValidUrl('https://example.com/path?query=param#hash')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(validation.isValidUrl('')).toBe(false);
      expect(validation.isValidUrl('not a url')).toBe(false);
      expect(validation.isValidUrl('git@github.com:user/repo.git')).toBe(false); // SSH URL not valid for URL constructor
      expect(validation.isValidUrl(null)).toBe(false);
      expect(validation.isValidUrl(undefined)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(validation.isNonEmptyString('hello')).toBe(true);
      expect(validation.isNonEmptyString(' with spaces ')).toBe(true);
    });

    it('should return false for empty strings or non-strings', () => {
      expect(validation.isNonEmptyString('')).toBe(false);
      expect(validation.isNonEmptyString('   ')).toBe(false);
      expect(validation.isNonEmptyString(null)).toBe(false);
      expect(validation.isNonEmptyString(undefined)).toBe(false);
      expect(validation.isNonEmptyString(123)).toBe(false);
      expect(validation.isNonEmptyString({})).toBe(false);
      expect(validation.isNonEmptyString([])).toBe(false);
    });
  });

  describe('isAllowedOption', () => {
    it('should return true when value is in allowed options', () => {
      expect(validation.isAllowedOption('apple', ['apple', 'banana', 'orange'] as const)).toBe(
        true
      );
      expect(validation.isAllowedOption('gitlab', ['gitlab', 'github'] as const)).toBe(true);
    });

    it('should return false when value is not in allowed options', () => {
      expect(validation.isAllowedOption('grape', ['apple', 'banana', 'orange'] as const)).toBe(
        false
      );
      expect(validation.isAllowedOption('bitbucket', ['gitlab', 'github'] as const)).toBe(false);
      expect(validation.isAllowedOption(null, ['gitlab', 'github'] as const)).toBe(false);
      expect(validation.isAllowedOption(undefined, ['gitlab', 'github'] as const)).toBe(false);
    });
  });
});
