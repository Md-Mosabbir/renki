import type { Request, Response } from 'express';
import { buildGreeting } from '../services/greeting.service.js';

/**
 * CONTROLLER — the only layer allowed to touch `req` and `res`.
 * Its job: pull input off the request, call a service, shape the response.
 * If a controller grows business logic, that logic belongs in a service.
 */
export function getGreeting(req: Request, res: Response): void {
  const audience = typeof req.query.name === 'string' ? req.query.name : 'world';
  const greeting = buildGreeting(audience);

  res.status(200).json({ data: greeting });
}
