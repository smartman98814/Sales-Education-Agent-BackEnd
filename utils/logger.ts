/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/**
 * Simple scoped logger wrapper for console methods
 */
// Logger class - simple wrapper around console

// Log levels enum
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private scope?: string;
  private minLevel: LogLevel;

  constructor(scope?: string) {
    this.scope = scope;
    this.minLevel = this.getMinLogLevel();
  }

  private getMinLogLevel(): LogLevel {
    // Check LOG_LEVEL env var or default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    }
  }

  // If scope is defined, prepend it to the arguments
  private prependScope(args: any[]): any[] {
    if (this.scope) {
      return [`[${this.scope}]`, ...args];
    }

    return args;
  }

  // Console method wrappers
  log(...args: any[]): void {
    if (LogLevel.DEBUG >= this.minLevel) {
      console.log(...this.prependScope(args));
    }
  }

  debug(...args: any[]): void {
    if (LogLevel.DEBUG >= this.minLevel) {
      console.debug(...this.prependScope(args));
    }
  }

  info(...args: any[]): void {
    if (LogLevel.INFO >= this.minLevel) {
      console.info(...this.prependScope(args));
    }
  }

  warn(...args: any[]): void {
    if (LogLevel.WARN >= this.minLevel) {
      console.warn(...this.prependScope(args));
    }
  }

  error(...args: any[]): void {
    if (LogLevel.ERROR >= this.minLevel) {
      console.error(...this.prependScope(args));
    }
  }

  trace(...args: any[]): void {
    // trace() is treated as debug level
    if (LogLevel.DEBUG >= this.minLevel) {
      console.trace(...this.prependScope(args));
    }
  }

  table(tabularData: any, properties?: readonly string[]): void {
    if (this.scope) {
      console.info(`[${this.scope}]`);
    }
    console.table(tabularData, properties);
  }

  time(label?: string): void {
    const timerLabel = this.scope ? `[${this.scope}] ${label || ''}` : label;
    console.time(timerLabel);
  }

  timeEnd(label?: string): void {
    const timerLabel = this.scope ? `[${this.scope}] ${label || ''}` : label;
    console.timeEnd(timerLabel);
  }

  child(childScope: string): Logger {
    const newScope = this.scope ? `${this.scope}:${childScope}` : childScope;

    return new Logger(newScope);
  }

  // Utility method to check current log level
  getLogLevel(): string {
    return LogLevel[this.minLevel];
  }
}

// Default logger instance (no scope)
export const logger = new Logger();

// Factory function for creating scoped loggers
export function createScopedLogger(scope: string): Logger {
  return new Logger(scope);
}

// Type exports
export type { Logger };
export { LogLevel };
