export interface QueryResult<T = any> {
  rows: T[];
}

export interface DatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
}

export type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export type ProgressReporter = (progress: number, message?: string) => Promise<void> | void;

export interface SyncContext {
  db: DatabaseClient;
  logger?: Logger;
  reportProgress?: ProgressReporter;
}

export const defaultLogger: Logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
