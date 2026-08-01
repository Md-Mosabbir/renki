/**
 * Throw this anywhere (controller, service) to produce a specific HTTP status.
 * Anything else that escapes becomes a 500.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
