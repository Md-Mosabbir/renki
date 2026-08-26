import type { Request, Response } from 'express';

import {
  getChallengeStatus,
  issueChallenge,
  listChallengeQueue,
  resolveChallenge,
  submitChallengePhoto,
} from '../services/gender-challenge.service.js';
import { challengePhotoKey, getObjectStore } from '../services/storage.service.js';
import { sniffImageType } from '../middlewares/upload.middleware.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — the gender challenge. The only layer that touches req/res.
 *
 * What used to live here: `verifyGender`, an UNAUTHENTICATED endpoint that took
 * a face descriptor computed in the browser and answered `verified: true`
 * unconditionally. Both halves of that were wrong — a client that computes its
 * own verdict can simply lie, and the gender-classification premise it served
 * was abandoned by migration 16.
 */

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.user.id;
}

function requireString(body: unknown, field: string): string {
  const raw = (body as Record<string, unknown> | null)?.[field];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new HttpError(400, `${field} is required`);
  }
  return raw.trim();
}

/* ------------------------------------------------------------------ *
 * The student's side
 * ------------------------------------------------------------------ */

/**
 * GET /api/verification/me
 *
 * Answers 200 with `challenge: null` when there is nothing to answer, rather
 * than 404. Nothing being asked of you is a normal state, not a missing
 * resource, and the dashboard calls this on every load.
 */
export async function getMyChallenge(req: Request, res: Response): Promise<void> {
  const challenge = await getChallengeStatus(requireUserId(req));
  res.status(200).json({ data: { challenge } });
}

/**
 * POST /api/verification/photo
 *
 * multipart/form-data, one file under `photo`.
 *
 * The object is written to storage BEFORE the row is updated. An object with no
 * row is sweepable garbage; a row pointing at an object that was never written
 * is a queue entry a moderator cannot open, which is strictly worse.
 */
export async function postChallengePhoto(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const file = req.file;
  if (!file) {
    throw new HttpError(400, 'Attach a photo in a field named "photo"');
  }

  const contentType = sniffImageType(file.buffer);
  if (!contentType) {
    throw new HttpError(400, 'That file is not a JPEG or PNG image');
  }

  const store = getObjectStore();
  const key = challengePhotoKey(userId);
  await store.put(key, file.buffer, contentType);

  let result;
  try {
    result = await submitChallengePhoto(userId, key);
  } catch (err) {
    // The row was not updated, so nothing points at this object. Drop it rather
    // than leaving a photograph of a student in a bucket that no record
    // mentions — the one kind of orphan that is a privacy problem rather than
    // a housekeeping one.
    await store.delete(key);
    throw err;
  }

  // A retake supersedes the previous upload. Deleted after the commit, never
  // inside it: a rollback would otherwise destroy the photo the row still
  // points at.
  if (result.supersededKey) {
    await store.delete(result.supersededKey);
  }

  res.status(200).json({ data: { challenge: result.view } });
}

/* ------------------------------------------------------------------ *
 * The moderator's side
 * ------------------------------------------------------------------ */

/**
 * GET /api/admin/challenges
 *
 * Signed URLs are minted here, per request, and never stored. They expire in
 * `SIGNED_URL_TTL_SECONDS`; the page refetches rather than caching them.
 */
export async function getChallengeQueue(_req: Request, res: Response): Promise<void> {
  const store = getObjectStore();
  const items = await listChallengeQueue();

  const cases = await Promise.all(
    items.map(async (item) => ({
      id: item.id,
      userId: item.userId,
      name: item.name,
      email: item.email,
      declaredGender: item.declaredGender,
      reportId: item.reportId,
      submittedAt: item.submittedAt.toISOString(),
      photoUrl: item.selfieObjectKey
        ? await store.signedReadUrl(item.selfieObjectKey, env.signedUrlTtlSeconds)
        : null,
    }))
  );

  res.status(200).json({ data: { cases } });
}

/**
 * POST /api/admin/challenges
 *
 * A moderator asks a student to answer an allegation. This is the step that a
 * report deliberately does NOT do on its own: if filing a report compelled
 * somebody to photograph themselves, reporting would be a harassment tool.
 */
export async function postChallenge(req: Request, res: Response): Promise<void> {
  const moderatorId = requireUserId(req);
  const userId = requireString(req.body, 'userId');

  const rawReport = (req.body as Record<string, unknown> | null)?.reportId;
  const reportId = typeof rawReport === 'string' && rawReport !== '' ? rawReport : null;

  const challenge = await issueChallenge(moderatorId, userId, reportId);
  res.status(201).json({ data: { challenge } });
}

/**
 * PATCH /api/admin/challenges/:id
 *
 * body: { cleared: boolean, note?: string }
 *
 * The photo is deleted after the transaction commits, whichever way the
 * decision went. It has served its entire purpose by this point, and keeping it
 * would turn a moment's evidence into a permanent record of somebody's face.
 */
export async function patchChallenge(req: Request, res: Response): Promise<void> {
  const moderatorId = requireUserId(req);

  const id = req.params.id;
  if (typeof id !== 'string' || id === '') {
    throw new HttpError(400, 'id is required');
  }

  const body = req.body as Record<string, unknown> | null;
  const cleared = body?.cleared;
  if (typeof cleared !== 'boolean') {
    throw new HttpError(400, 'cleared must be true or false');
  }
  const note = typeof body?.note === 'string' ? body.note.trim() : undefined;

  const { objectKey } = await resolveChallenge(moderatorId, id, cleared, note);

  if (objectKey) {
    await getObjectStore().delete(objectKey);
  }

  res.status(200).json({ data: { ok: true } });
}
