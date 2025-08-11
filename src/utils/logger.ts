import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message: string;
  meta?: any;
}

export class Logger {
  private static logDir = path.join(process.cwd(), 'exports', 'logs');
  private static logFilePath: string | null = null;
  private static originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  static initialize(): void {
    // Ensure directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    if (!this.logFilePath) {
      const timestamp = Logger.getTimestamp();
      this.logFilePath = path.join(this.logDir, `app_${timestamp}.log`);
      fs.writeFileSync(this.logFilePath, `=== DB Backup Converter Log (${new Date().toISOString()}) ===\n`);
    }

    // Mirror console to file in the main process
    console.log = (...args: any[]) => {
      Logger.write('INFO', undefined, args);
      Logger.originalConsole.log.apply(console, args);
    };
    console.warn = (...args: any[]) => {
      Logger.write('WARN', undefined, args);
      Logger.originalConsole.warn.apply(console, args);
    };
    console.error = (...args: any[]) => {
      Logger.write('ERROR', undefined, args);
      Logger.originalConsole.error.apply(console, args);
    };
  }

  static startSection(title: string): void {
    this.append(`\n--- ${title} ---\n`);
  }

  static info(message: string, meta?: any, context?: string): void {
    Logger.write('INFO', context, [message, meta]);
  }

  static warn(message: string, meta?: any, context?: string): void {
    Logger.write('WARN', context, [message, meta]);
  }

  static error(err: any, context?: string, meta?: any): void {
    const msg = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
    Logger.write('ERROR', context, [msg, meta]);
  }

  static getCurrentLogPath(): string | null {
    return this.logFilePath;
  }

  static withContext(context: string) {
    return {
      info: (message: string, meta?: any) => Logger.info(message, meta, context),
      warn: (message: string, meta?: any) => Logger.warn(message, meta, context),
      error: (err: any, meta?: any) => Logger.error(err, context, meta),
    };
  }

  private static write(level: LogLevel, context: string | undefined, args: any[]): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: args
        .filter((a) => a !== undefined)
        .map((a) => (typeof a === 'string' ? a : Logger.safeStringify(a)))
        .join(' '),
    };

    const line = `[${entry.timestamp}] [${entry.level}]${entry.context ? ` [${entry.context}]` : ''} ${entry.message}\n`;
    this.append(line);
  }

  private static append(text: string): void {
    try {
      if (!this.logFilePath) {
        // Initialize if not yet
        this.initialize();
      }
      fs.appendFileSync(this.logFilePath!, text);
    } catch {
      // Swallow logging errors
    }
  }

  private static safeStringify(value: any): string {
    try {
      if (value instanceof Error) {
        return `${value.message}${value.stack ? `\n${value.stack}` : ''}`;
      }
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private static getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }
} 