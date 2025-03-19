type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LoggerOptions {
  level?: LogLevel;
  silent?: boolean;
  verbose?: boolean;
}

/**
 * Simple logging utility with levels
 */
export class Logger {
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  private level: LogLevel;
  private silent: boolean;
  private verbose: boolean;
  private readonly levels: Record<LogLevel, number>;

  constructor(verbose: boolean = false, options: LoggerOptions = {}) {
    this.verbose = verbose;
    this.level = this.verbose ? 'debug' : options.level || 'info';
    this.silent = options.silent || false;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
  }

  /**
   * Log an error message
   * @param message - Message to log
   * @param error - Optional error object
   */
  error(message: string, error?: Error | null): void {
    if (this.silent) {
      return;
    }
    // Errors are always shown regardless of verbose setting
    if (this.levels[this.level] >= this.levels.error) {
      console.error(`[ERROR] ${message}`);
      if (error) {
        console.error(error.stack || error);
      }
    }
  }

  /**
   * Log a warning message
   * @param message - Message to log
   */
  warn(message: string): void {
    if (this.silent) {
      return;
    }
    // Only show warnings in verbose mode or if level explicitly includes warnings
    if ((this.verbose || this.level === 'warn') && this.levels[this.level] >= this.levels.warn) {
      console.warn(`[WARN] ${message}`);
    }
  }

  /**
   * Log an info message
   * @param message - Message to log
   */
  info(message: string): void {
    if (this.silent) {
      return;
    }
    // Only show info messages in verbose mode or if level explicitly includes info
    if ((this.verbose || this.level === 'info') && this.levels[this.level] >= this.levels.info) {
      console.log(`[INFO] ${message}`);
    }
  }

  /**
   * Log a debug message
   * @param message - Message to log
   */
  debug(message: string): void {
    if (this.silent) {
      return;
    }
    // Only show debug messages in verbose mode
    if (this.verbose && this.levels[this.level] >= this.levels.debug) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log a message directly to the user without any prefixes
   * These messages are always shown regardless of verbose setting
   * @param message - Message to log
   */
  user(message: string): void {
    if (this.silent) {
      return;
    }
    console.log(message);
  }

  /**
   * Create a new logger instance
   * @param verbose - Whether to enable verbose logging
   * @param options - Logger options
   * @returns A new logger instance
   */
  static create(verbose: boolean = false, options: LoggerOptions = {}): Logger {
    return new Logger(verbose, options);
  }
}
