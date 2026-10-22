export class RequestJsonError extends Error {
  readonly status: 400 | 413;
  readonly code: "invalid_request" | "request_too_large";

  constructor(status: 400 | 413) {
    super(status === 413 ? "request_too_large" : "invalid_request");
    this.name = "RequestJsonError";
    this.status = status;
    this.code = status === 413 ? "request_too_large" : "invalid_request";
  }
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Bound the bytes actually read; Content-Length is only an early rejection hint. */
export async function readRequestJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError("invalid_body_limit");
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new RequestJsonError(413);
  if (!request.body) throw new RequestJsonError(400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new RequestJsonError(413);
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* A broken stream is already unusable. */ }
    throw error instanceof RequestJsonError ? error : new RequestJsonError(400);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new RequestJsonError(400); }
}
