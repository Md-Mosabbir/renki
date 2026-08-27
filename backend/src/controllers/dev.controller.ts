import type { Request, Response } from 'express';

import { toPublicUser } from '../models/user.model.js';
import type { UserRow } from '../models/user.model.js';
import { env } from '../config/env.js';
import { query } from '../db/database.singleton.js';
import { attestVerified } from '../services/gender-challenge.service.js';
import { signAccessToken } from '../services/auth.service.js';
import { findById } from '../services/user.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — development sign-in. NOT MOUNTED IN PRODUCTION.
 *
 * Renki's only real login is Google, restricted to @northsouth.edu. That is
 * correct and it makes the app almost impossible to test: friends, groups and
 * the meetup scan are all two-person flows, and the fixture accounts have no
 * Google logins behind them. Testing them meant pasting a JWT into a browser
 * console, which is unworkable on a phone.
 *
 * So this hands out a session for a seeded account with no proof of anything.
 * It is an authentication bypass, stated plainly, and it is contained three
 * ways:
 *
 *   1. `routes/index.ts` only mounts this router when NODE_ENV is not
 *      production, so in production the URL does not exist and 404s.
 *   2. Every handler below re-checks anyway, because a router mounted by
 *      mistake should still refuse rather than comply.
 *   3. It can only ever return accounts that already exist. It creates nothing.
 *
 * Delete this file and its route to remove the whole surface.
 */

function refuseInProduction(): void {
  if (env.isProduction) {
    throw new HttpError(404, 'Not found');
  }
}

const DEV_USER_COLUMNS = `
  id, name, email, google_id, profile_picture_url, id_card_image_url,
  gender, university, created_at, trust_stage, qr_token, qr_token_expires_at,
  date_of_birth, phone, student_id, profile_completed_at, is_admin,
  match_open_to_all, id_card_captured_at
`;

/**
 * GET /api/dev/users
 *
 * The account picker's list. Returns the public shape, so the picker can show
 * gender and trust stage — which are exactly what decides whether two of these
 * accounts can be friends, and the first thing to check when they cannot.
 */
export async function getDevUsers(_req: Request, res: Response): Promise<void> {
  refuseInProduction();

  const { rows } = await query<UserRow>(
    `SELECT ${DEV_USER_COLUMNS} FROM users ORDER BY gender, name`
  );

  res.status(200).json({ data: { users: rows.map(toPublicUser) } });
}

/**
 * POST /api/dev/login — body: { email }
 *
 * Issues the same token the Google flow issues, from the same signer, so
 * everything downstream behaves identically. Nothing about the session that
 * comes back is special — which is the point, because a session that behaved
 * differently would not be testing the real thing.
 */
export async function postDevLogin(req: Request, res: Response): Promise<void> {
  refuseInProduction();

  const { email } = req.body as { email?: unknown };
  if (typeof email !== 'string' || email === '') {
    throw new HttpError(400, 'email is required');
  }

  const { rows } = await query<UserRow>(
    `SELECT ${DEV_USER_COLUMNS} FROM users WHERE email = $1`,
    [email]
  );

  const row = rows[0];
  if (!row) {
    // Deliberately does NOT create the account. A dev login that invents users
    // would drift the database away from the seeds, and "why does this account
    // have no friendships" would become a mystery worth an afternoon.
    throw new HttpError(404, 'No seeded account with that email. Run npm run seed.');
  }

  const token = await signAccessToken(row.id, row.email);

  res.status(200).json({ data: { token, user: toPublicUser(row) } });
}

/**
 * POST /api/dev/verify
 *
 * Marks the caller verified with no evidence. This replaces the old
 * `POST /api/verification/self`, which did the same thing behind an
 * `ALLOW_SELF_VERIFY` env flag on a PUBLIC route.
 *
 * Moving it here is the whole point: a flag is something somebody can switch on
 * in a dashboard, while `routes/index.ts` refuses to mount `/api/dev` outside
 * development at all. The deploy smoke test already asserts `/api/dev/login`
 * answers 404 in production, so this inherits a check that exists rather than
 * relying on a new one.
 *
 * Returns the updated user rather than a bare 204: the client branches on
 * `trustStage`, so a response without it forces an immediate second request.
 */
export async function postDevVerify(req: Request, res: Response): Promise<void> {
  refuseInProduction();

  if (!req.user) {
    throw new HttpError(
      401,
      'Sign in first — this verifies the caller, not a named account'
    );
  }

  // req.user.id, never an id from the body. Otherwise this verifies whoever the
  // caller names, which is a different and much worse thing.
  await attestVerified(req.user.id);

  const row = await findById(req.user.id);
  if (!row) {
    throw new HttpError(401, 'Account no longer exists');
  }

  res.status(200).json({ data: { user: toPublicUser(row) } });
}
