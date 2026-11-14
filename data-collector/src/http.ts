import { USER_AGENT } from "./types.ts";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly bodyPreview?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  accept?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<{
  status: number;
  contentType: string;
  body: string;
  finalUrl: string;
}> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const retries = options.retries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 1_500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: options.accept ?? "*/*",
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        const preview = body.slice(0, 400).replace(/\s+/g, " ");
        const err = new HttpError(
          `HTTP ${response.status} for ${url}: ${preview}`,
          response.status,
          url,
          preview,
        );
        // Retry transient errors
        if (response.status >= 500 && attempt < retries) {
          lastError = err;
          await sleep(retryDelayMs * attempt);
          continue;
        }
        throw err;
      }
      return { status: response.status, contentType, body, finalUrl: response.url };
    } catch (error) {
      lastError = error;
      const transient =
        error instanceof HttpError
          ? error.status >= 500
          : error instanceof Error &&
            (error.name === "TimeoutError" ||
              error.name === "AbortError" ||
              /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(error.message));
      if (attempt < retries && transient) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const result = await fetchText(url, {
    ...options,
    accept: options.accept ?? "application/json,text/json,*/*",
  });
  try {
    return JSON.parse(result.body) as T;
  } catch (error) {
    const preview = result.body.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`Invalid JSON from ${url} (${result.contentType}): ${preview}`);
  }
}
