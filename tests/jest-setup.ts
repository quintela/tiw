import { jest } from '@jest/globals';

// Make jest available globally
Object.defineProperty(globalThis, 'jest', {
  value: jest,
  writable: false,
  enumerable: false,
  configurable: false,
});

// Export jest for ESM modules
export { jest };
