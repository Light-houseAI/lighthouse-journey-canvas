export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export class ConsoleLogger implements Logger {
  constructor(private context?: string) {}

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('INFO', message), ...args);
  }

  error(message: string, error?: Error, ...args: any[]): void {
    console.error(this.formatMessage('ERROR', message), error, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('WARN', message), ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const contextPart = this.context ? `[${this.context}] ` : '';
    return `[${timestamp}] ${level}: ${contextPart}${message}`;
  }
}

export function createLogger(context?: string): Logger {
  return new ConsoleLogger(context);
}