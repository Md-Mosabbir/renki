import type { Request, Response } from 'express';

import { reinstateAccount, suspendAccount } from '../services/moderation.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — the two consequences a moderator can impose.
 *
 * Mounted under `/api/admin`, so `requireAdmin` has already answered 404 to
 * everyone else before any of this runs.
 */

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.user.id;
}

function requireParam(req: Request, name: string): string {
  const raw = req.params[name];
  if (typeof raw !== 'string' || raw === '') {
    throw new HttpError(400, `${name} is required`);
  }
  return raw;
}

/**
 * POST /api/admin/reports/:id/suspend   body: { reason?: string }
 *
 * Addressed by report, not by user. A moderator cannot suspend somebody
 * without a filed report to attach it to, which is what makes the decision
 * reviewable by the next person to open the queue.
 *
 * The report is closed by the same transaction — see `suspendAccount` for why
 * leaving it open would lock the reporter out of ever reporting that person
 * again.
 */
export async function postSuspend(req: Request, res: Response): Promise<void> {
  const moderatorId = requireUserId(req);
  const reportId = requireParam(req, 'id');

  const raw = (req.body as Record<string, unknown> | null)?.reason;
  const reason = typeof raw === 'string' ? raw : null;

  const result = await suspendAccount(moderatorId, reportId, reason);
  res.status(200).json({ data: { suspension: result } });
}

/**
 * POST /api/admin/users/:id/reinstate
 *
 * By user id, unlike suspending. A reinstatement is not evidence of anything
 * and has no report to attach to — the one that caused the suspension was
 * closed when it was imposed.
 */
export async function postReinstate(req: Request, res: Response): Promise<void> {
  const moderatorId = requireUserId(req);
  const userId = requireParam(req, 'id');

  const result = await reinstateAccount(moderatorId, userId);
  res.status(200).json({ data: { account: result } });
}
