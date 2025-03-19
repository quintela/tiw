import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Logger } from '@/utils/logging';

describe('Logger', () => {
  // Store original console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });

  describe('constructor', () => {
    it('should use default options if none provided', () => {
      const logger = new Logger(false, { level: 'info' });

      // Test with info message (should show with default 'info' level)
      logger.info('Test info message');
      expect(console.log).toHaveBeenCalledWith('[INFO] Test info message');

      // Test with debug message (should not show with default 'info' level)
      logger.debug('Test debug message');
      expect(console.log).not.toHaveBeenCalledWith('[DEBUG] Test debug message');
    });

    it('should respect verbose mode', () => {
      const logger = new Logger(true);

      logger.debug('Test debug message');
      expect(console.log).toHaveBeenCalledWith('[DEBUG] Test debug message');
    });

    it('should respect silent option', () => {
      const logger = new Logger(false, { silent: true });

      logger.error('Test error message');
      logger.warn('Test warn message');
      logger.info('Test info message');
      logger.debug('Test debug message');

      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('setLevel', () => {
    it('should change the log level', () => {
      const logger = new Logger(false, { level: 'error' });

      // Initially only error messages should show
      logger.error('Error message');
      logger.warn('Warn message');
      expect(console.error).toHaveBeenCalledWith('[ERROR] Error message');
      expect(console.warn).not.toHaveBeenCalled();

      // Change log level to debug and enable verbose
      logger.setLevel('debug');
      (logger as any).verbose = true;

      jest.clearAllMocks();
      logger.error('Error message');
      logger.warn('Warn message');
      logger.info('Info message');
      logger.debug('Debug message');

      expect(console.error).toHaveBeenCalledWith('[ERROR] Error message');
      expect(console.warn).toHaveBeenCalledWith('[WARN] Warn message');
      expect(console.log).toHaveBeenCalledWith('[INFO] Info message');
      expect(console.log).toHaveBeenCalledWith('[DEBUG] Debug message');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      const logger = new Logger(false);

      logger.error('Test error');
      expect(console.error).toHaveBeenCalledWith('[ERROR] Test error');
    });

    it('should log error object if provided', () => {
      const logger = new Logger(false);
      const testError = new Error('Test error object');

      logger.error('Error message', testError);

      expect(console.error).toHaveBeenCalledWith('[ERROR] Error message');
      expect(console.error).toHaveBeenCalledWith(testError.stack);
    });
  });

  describe('warn', () => {
    it('should log warning messages in verbose mode', () => {
      const logger = new Logger(true, { level: 'warn' });

      logger.warn('Test warning');
      expect(console.warn).toHaveBeenCalledWith('[WARN] Test warning');
    });

    it('should not log warning messages in non-verbose mode with level < warn', () => {
      const logger = new Logger(false, { level: 'error' });

      logger.warn('Test warning');
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info messages in verbose mode', () => {
      const logger = new Logger(true, { level: 'info' });

      logger.info('Test info');
      expect(console.log).toHaveBeenCalledWith('[INFO] Test info');
    });

    it('should not log info messages in non-verbose mode with level < info', () => {
      const logger = new Logger(false, { level: 'warn' });

      logger.info('Test info');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log debug messages in verbose mode', () => {
      const logger = new Logger(true);

      logger.debug('Test debug');
      expect(console.log).toHaveBeenCalledWith('[DEBUG] Test debug');
    });

    it('should not log debug messages in non-verbose mode', () => {
      const logger = new Logger(false);

      logger.debug('Test debug');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('user', () => {
    it('should log messages directly without prefixes', () => {
      const logger = new Logger(false);

      logger.user('Direct user message');
      expect(console.log).toHaveBeenCalledWith('Direct user message');
    });

    it('should not log user messages when silent', () => {
      const logger = new Logger(false, { silent: true });

      logger.user('User message');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a new logger instance', () => {
      const logger = Logger.create(true, { level: 'debug' });

      logger.debug('Test debug');
      expect(console.log).toHaveBeenCalledWith('[DEBUG] Test debug');
    });
  });
});
