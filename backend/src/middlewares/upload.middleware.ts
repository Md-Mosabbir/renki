import type { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';

import { HttpError } from '../utils/http-error.js';

/**
 * MIDDLEWARE — the one file upload in this app.
 *
 * A gender-challenge photo, and nothing else. Mounted on that single route
 * rather than with `app.use`, deliberately: a multipart parser on every
 * endpoint is a parser on forty endpoints that will never receive one, and the
 * global `express.json()` limit stays at its 100 kb default where it belongs.
 *
 * memoryStorage, not disk. The buffer goes straight to object storage and is
 * never written to the API's filesystem — Render's disk is ephemeral, and a
 * half-cleaned temp directory of students' photographs is not a thing to own.
 */

/**
 * The ceiling, not the expectation.
 *
 * The browser downscales to roughly 150-300 KB before uploading. This exists
 * for a client that does not, and for the phone that produces a 12 MP JPEG.
 */
const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

/** Accepts exactly one file, under the field name `photo`. */
export const acceptPhoto = upload.single('photo');

/**
 * Turn multer's errors into answers a student can act on.
 *
 * Express 5 forwards these to the error middleware as-is, where a MulterError
 * would surface as a 500 saying "Unexpected field" — true, useless, and
 * indistinguishable from the server being broken.
 */
export function handleUploadErrors(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new HttpError(413, 'That photo is too large. 5 MB is the limit.'));
      return;
    }
    next(new HttpError(400, 'Send exactly one photo, in a field named "photo".'));
    return;
  }
  next(err);
}

/**
 * Magic bytes for the two formats a camera capture can produce.
 *
 * `file.mimetype` is whatever the client typed in the multipart header and is
 * worth nothing — it is trivially set to `image/jpeg` on a zip. These first
 * bytes are the actual file, and checking them is what stops the bucket
 * becoming general-purpose hosting for anything a signed-in student wants to
 * put there.
 */
const SIGNATURES: ReadonlyArray<{ bytes: readonly number[]; contentType: string }> = [
  { bytes: [0xff, 0xd8, 0xff], contentType: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], contentType: 'image/png' },
];

/**
 * The real content type, read from the file itself.
 *
 * Returns null for anything that is not a JPEG or PNG. Callers turn that into a
 * 400 — not a 500, because sending the wrong file is the student's mistake and
 * they can fix it by choosing another one.
 */
export function sniffImageType(buffer: Buffer): string | null {
  for (const { bytes, contentType } of SIGNATURES) {
    if (bytes.every((byte, index) => buffer[index] === byte)) {
      return contentType;
    }
  }
  return null;
}
