export declare const TRANSIENT_DB_CODES: Set<string>;

export declare function isTransientDbError(err: unknown): boolean;

export declare function withAdminRetry<T>(
  label: string,
  fn: (attempt: number) => Promise<T> | T,
  opts?: {
    tries?: number;
    delayMs?: number;
    maxDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    log?: (msg: string) => void;
  },
): Promise<T>;
