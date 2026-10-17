
/** Structural bindings used by this application; runtime supplied by Sites. */
interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta: { changes: number; last_row_id: number } }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}
interface Fetcher { fetch(request: Request): Promise<Response> }
declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    BUCKET: {
      get(key: string, options?: {range?:Headers}): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; body?:ReadableStream<Uint8Array>;
        size?:number;range?:{offset:number;length:number} } | null>;
      put(key: string, data: Uint8Array | ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
    };
  };
}
