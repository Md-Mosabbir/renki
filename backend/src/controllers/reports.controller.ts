import type { Request, Response } from 'express';

import { isReviewAction, validateReportInput } from '../models/report.model.js';
import {
  ADMIN_PAGE_SIZE,
  createReport,
  listMyReports,
  listReportsForAdmin,
  reviewReport,
} from '../services/report.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — filing reports, and the moderation queue.
 *
 * Who may report whom, and what a report does NOT do (it does not block — see
 * report.service.ts), are decided in the service. Nothing here has an opinion.
 */

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.user.id;
}

/** POST /api/reports */
export async function postReport(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const result = validateReportInput(req.body);
  if (!result.valid) {
    throw new HttpError(400, result.reason);
  }

  const report = await createReport(userId, result.value);
  res.status(201).json({ data: { report } });
}

/** GET /api/reports/mine */
export async function getMyReports(req: Request, res: Response): Promise<void> {
  const reports = await listMyReports(requireUserId(req));
  res.status(200).json({ data: { reports } });
}

/** GET /api/admin/reports?status=&limit=&offset= */
export async function getAdminReports(req: Request, res: Response): Promise<void> {
  requireUserId(req);

  const status = typeof req.query.status === 'string' ? req.query.status : null;

  const page = await listReportsForAdmin(
    status,
    positiveNumber(req.query.limit) ?? ADMIN_PAGE_SIZE,
    positiveNumber(req.query.offset) ?? 0
  );

  res.status(200).json({ data: page });
}

/** PATCH /api/admin/reports/:id   body: { status } */
export async function patchAdminReport(req: Request, res: Response): Promise<void> {
  const adminId = requireUserId(req);

  const reportId = req.params.id;
  if (typeof reportId !== 'string' || reportId === '') {
    throw new HttpError(400, 'id is required');
  }

  const { status } = req.body as { status?: unknown };
  if (!isReviewAction(status)) {
    throw new HttpError(400, "status must be 'under_review', 'resolved' or 'dismissed'");
  }

  const report = await reviewReport(adminId, reportId, status);
  res.status(200).json({ data: { report } });
}

/** Same tolerance as the ride-history endpoint: junk falls back to the default. */
function positiveNumber(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
