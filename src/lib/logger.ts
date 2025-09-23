/**
 * Comprehensive Logging Service for JASB
 *
 * This service provides detailed logging capabilities to help diagnose issues:
 * - Network requests and responses
 * - Authentication flows
 * - Navigation events
 * - User interactions
 * - Error tracking
 * - Performance monitoring
 */

import { Platform } from 'react-native';

// Log levels for filtering
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE',
}

// Log categories for better organization
export enum LogCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  NAVIGATION = 'NAVIGATION',
  UI = 'UI',
  API = 'API',
  STORAGE = 'STORAGE',
  PERFORMANCE = 'PERFORMANCE',
  ERROR = 'ERROR',
  USER_ACTION = 'USER_ACTION',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  error?: Error;
  context?: {
    screen?: string;
    userId?: string;
    groupId?: string;
    requestId?: string;
    performanceMetrics?: any;
  };
}

interface NetworkLogData {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  response?: {
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    data?: any;
  };
  duration?: number;
  error?: string;
}

interface AuthLogData {
  action: 'sign_in' | 'sign_up' | 'sign_out' | 'token_refresh' | 'auth_check';
  userId?: string;
  email?: string;
  method?: 'email' | 'oauth' | 'dev_bypass';
  success: boolean;
  error?: string;
}

interface NavigationLogData {
  from?: string;
  to: string;
  params?: any;
  type: 'push' | 'replace' | 'back' | 'reset';
}

interface UILogData {
  component: string;
  action: string;
  props?: any;
  state?: any;
}

interface PerformanceLogData {
  metric: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  context?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory
  private minLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex <= currentLevelIndex;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console based on level
    const consoleMethod = this.getConsoleMethod(entry.level);
    const prefix = `[${entry.level}][${entry.category}]`;
    const message = `${prefix} ${entry.message}`;

    if (entry.data || entry.error) {
      consoleMethod(message, {
        data: entry.data,
        error: entry.error,
        context: entry.context,
      });
    } else {
      consoleMethod(message);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
      default:
        return console.log;
    }
  }

  // Core logging methods
  error(
    category: LogCategory,
    message: string,
    error?: Error,
    data?: any,
    context?: LogEntry['context']
  ): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    this.addLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.ERROR,
      category,
      message,
      error,
      data,
      context,
    });
  }

  warn(
    category: LogCategory,
    message: string,
    data?: any,
    context?: LogEntry['context']
  ): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    this.addLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.WARN,
      category,
      message,
      data,
      context,
    });
  }

  info(
    category: LogCategory,
    message: string,
    data?: any,
    context?: LogEntry['context']
  ): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.addLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.INFO,
      category,
      message,
      data,
      context,
    });
  }

  debug(
    category: LogCategory,
    message: string,
    data?: any,
    context?: LogEntry['context']
  ): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    this.addLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.DEBUG,
      category,
      message,
      data,
      context,
    });
  }

  trace(
    category: LogCategory,
    message: string,
    data?: any,
    context?: LogEntry['context']
  ): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;

    this.addLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.TRACE,
      category,
      message,
      data,
      context,
    });
  }

  // Specialized logging methods for common use cases

  /**
   * Log network requests and responses
   */
  networkRequest(data: Omit<NetworkLogData, 'response' | 'duration'>): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.info(LogCategory.NETWORK, `HTTP ${data.method} ${data.url}`, data, {
      requestId,
    });

    return requestId;
  }

  networkResponse(
    requestId: string,
    data: Pick<NetworkLogData, 'response' | 'duration' | 'error'>
  ): void {
    const level = data.error || (data.response && data.response.status >= 400)
      ? LogLevel.ERROR
      : LogLevel.INFO;

    const message = data.error
      ? `Network request failed: ${data.error}`
      : `HTTP ${data.response?.status} (${data.duration}ms)`;

    if (level === LogLevel.ERROR) {
      this.error(LogCategory.NETWORK, message, undefined, data, { requestId });
    } else {
      this.info(LogCategory.NETWORK, message, data, { requestId });
    }
  }

  /**
   * Log authentication events
   */
  auth(data: AuthLogData): void {
    const level = data.success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Auth ${data.action}: ${data.success ? 'success' : 'failed'}`;

    if (level === LogLevel.ERROR) {
      this.error(LogCategory.AUTH, message, undefined, data);
    } else {
      this.info(LogCategory.AUTH, message, data);
    }
  }

  /**
   * Log navigation events
   */
  navigation(data: NavigationLogData): void {
    const message = `Navigate ${data.type}: ${data.from || 'unknown'} → ${data.to}`;
    this.debug(LogCategory.NAVIGATION, message, data);
  }

  /**
   * Log UI component events
   */
  ui(data: UILogData): void {
    const message = `${data.component}: ${data.action}`;
    this.debug(LogCategory.UI, message, data);
  }

  /**
   * Log user actions
   */
  userAction(action: string, data?: any, context?: LogEntry['context']): void {
    this.info(LogCategory.USER_ACTION, `User: ${action}`, data, context);
  }

  /**
   * Log performance metrics
   */
  performance(data: PerformanceLogData): void {
    const message = `${data.metric}: ${data.value}${data.unit}`;
    this.debug(LogCategory.PERFORMANCE, message, data);
  }

  /**
   * Log API-specific events
   */
  apiCall(endpoint: string, method: string, data?: any): string {
    const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.info(LogCategory.API, `API ${method} ${endpoint}`, data, {
      requestId,
    });

    return requestId;
  }

  apiResponse(requestId: string, success: boolean, data?: any, error?: Error): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `API response: ${success ? 'success' : 'error'}`;

    if (level === LogLevel.ERROR) {
      this.error(LogCategory.API, message, error, data, { requestId });
    } else {
      this.info(LogCategory.API, message, data, { requestId });
    }
  }

  // Utility methods

  /**
   * Get all logs or filter by criteria
   */
  getLogs(filter?: {
    level?: LogLevel;
    category?: LogCategory;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter?.level) {
      const levels = Object.values(LogLevel);
      const levelIndex = levels.indexOf(filter.level);
      filteredLogs = filteredLogs.filter(log =>
        levels.indexOf(log.level) <= levelIndex
      );
    }

    if (filter?.category) {
      filteredLogs = filteredLogs.filter(log => log.category === filter.category);
    }

    if (filter?.since) {
      filteredLogs = filteredLogs.filter(log =>
        new Date(log.timestamp) >= filter.since!
      );
    }

    if (filter?.limit) {
      filteredLogs = filteredLogs.slice(-filter.limit);
    }

    return filteredLogs;
  }

  /**
   * Get summary of recent errors
   */
  getErrorSummary(sinceMinutes = 10): {
    totalErrors: number;
    categories: Record<LogCategory, number>;
    recentErrors: LogEntry[];
  } {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    const errors = this.getLogs({ level: LogLevel.ERROR, since });

    const categories = Object.values(LogCategory).reduce(
      (acc, cat) => ({ ...acc, [cat]: 0 }),
      {} as Record<LogCategory, number>
    );

    errors.forEach(error => {
      categories[error.category]++;
    });

    return {
      totalErrors: errors.length,
      categories,
      recentErrors: errors.slice(-5), // Last 5 errors
    };
  }

  /**
   * Export logs for debugging
   */
  exportLogs(format: 'json' | 'text' = 'json'): string {
    if (format === 'text') {
      return this.logs
        .map(log => `[${log.timestamp}] ${log.level} ${log.category}: ${log.message}`)
        .join('\n');
    }

    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.info(LogCategory.UI, 'Logs cleared');
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
    this.info(LogCategory.UI, `Log level set to ${level}`);
  }

  /**
   * Get current app context for logging
   */
  getAppContext(): Record<string, any> {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      isDev: __DEV__,
      timestamp: this.formatTimestamp(),
    };
  }
}

// Create singleton instance
export const logger = new Logger();

// Development helpers
if (__DEV__) {
  // Make logger available in global scope for debugging
  (global as any).logger = logger;

  // Log app startup
  logger.info(LogCategory.UI, 'Logger initialized', {
    platform: Platform.OS,
    version: Platform.Version,
    isDev: __DEV__,
  });
}

// Export types for use in other files
export type { LogEntry, NetworkLogData, AuthLogData, NavigationLogData, UILogData, PerformanceLogData };