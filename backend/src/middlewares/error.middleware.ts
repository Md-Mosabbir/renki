import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/** Runs when no route matched. Hands a 404 to the error handler below. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * The single exit point for every failure in the app. Express identifies an
 * error handler by its four arguments, so `_next` must stay even though it is
 * unused.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof HttpError
      ? err.message
      : env.isProduction
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : 'Unknown error';

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      status,
      message,
      ...(env.isProduction
        ? {}
        : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
}
