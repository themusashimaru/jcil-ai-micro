/**
 * HTTP Client with Timeout Support
 *
 * Implements:
 * - 30s total request timeout
 * - 5s connect timeout (first byte deadline)
 * - AbortController-based cancellation
 */

export interface HttpOptions extends RequestInit {
  timeoutMs?: number;
  connectTimeoutMs?: number;
}

/**
 * Fetch with configurable timeouts
 * @param input - URL or Request object
 * @param init - Fetch options plus timeout configuration
 */
export async function httpWithTimeout(
  input: RequestInfo | URL,
  init: HttpOptions = {}
): Promise<Response> {
  const { timeoutMs = 30_000, connectTimeoutMs = 5_000, ...rest } = init;

  const controller = new AbortController();

  // Total request timeout
  const totalTimeout = setTimeout(
    () => controller.abort(new Error('request-timeout')),
    timeoutMs
  );

  try {
    const res = await fetch(input, { ...rest, signal: controller.signal });
    clearTimeout(totalTimeout);

    // If no body, return immediately
    if (!res.body) {
      return res;
    }

    // Connect timeout (first byte deadline)
    const reader = res.body.getReader();
    let connectTimeout: NodeJS.Timeout | null = setTimeout(
      () => controller.abort(new Error('connect-timeout')),
      connectTimeoutMs
    );

    const first = await reader.read();
    if (connectTimeout) {
      clearTimeout(connectTimeout);
      connectTimeout = null;
    }

    // Re-construct stream with the first chunk
    const stream = new ReadableStream({
      start(streamController) {
        if (!first.done && first.value) {
          streamController.enqueue(first.value);
        }
        if (first.done) {
          streamController.close();
          return;
        }

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                streamController.close();
                break;
              }
              streamController.enqueue(value);
            }
          } catch (err) {
            streamController.error(err);
          }
        };
        pump();
      },
    });

    return new Response(stream, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } catch (error) {
    clearTimeout(totalTimeout);
    throw error;
  }
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === 'request-timeout' || error.message === 'connect-timeout';
  }
  return false;
}
