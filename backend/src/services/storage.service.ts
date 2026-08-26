import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/**
 * SERVICE — private object storage, for the one thing Renki stores an image of.
 *
 * A gender-challenge photo lives here from the moment a student uploads it
 * until a moderator rules, and is deleted immediately after. Nothing else in
 * this app stores an image, and nothing here is retained: there is no ID card,
 * no profile photo, no archive.
 *
 * The bucket is PRIVATE. Reads happen through short-lived signed URLs minted
 * per admin page view and never persisted — a URL stored in a row would be a
 * credential with an expiry date nobody is watching.
 */

export interface ObjectStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** A time-limited read URL. Local HMAC, no network call. */
  signedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/**
 * Key for a challenge photo.
 *
 * The random component matters: keys must be unguessable, so that a leaked one
 * is a leaked photo rather than a leaked pattern for everyone else's. The user
 * id is in the path only so a person's objects can be swept together when their
 * account is deleted.
 */
export function challengePhotoKey(userId: string): string {
  return `challenges/${userId}/${randomUUID()}.jpg`;
}

/* ------------------------------------------------------------------ *
 * The real one
 * ------------------------------------------------------------------ */

class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly bucket: string) {
    this.client = new S3Client({
      endpoint: env.storageEndpoint,
      region: env.storageRegion,
      // Supabase does not serve virtual-host style buckets. Without this the
      // SDK builds `https://<bucket>.<host>/...` and every request fails DNS.
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.storageAccessKeyId,
        secretAccessKey: env.storageSecretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
    } catch (err) {
      console.error('[storage] put failed', err);
      throw new HttpError(502, 'Could not store the photo. Try again.');
    }
  }

  async delete(key: string): Promise<void> {
    // Deliberately does NOT throw. Every caller deletes after its transaction
    // has committed, so a failure here means an orphaned object and nothing
    // worse — whereas throwing would turn a successful moderation decision into
    // a 500 and invite the moderator to make it twice.
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      console.error(`[storage] delete failed for ${key} — orphaned object`, err);
    }
  }

  signedReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  }
}

/* ------------------------------------------------------------------ *
 * The development one
 * ------------------------------------------------------------------ */

/**
 * Holds objects in a Map. DEVELOPMENT AND TESTS ONLY.
 *
 * Same role as the mock matcher that used to live beside it: with no bucket
 * configured, the whole challenge flow still runs end to end. Its signed URL is
 * a `data:` URI, which a browser renders exactly like the real thing — so the
 * admin review screen can be built and clicked through with no cloud account.
 */
export class InMemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  signedReadUrl(key: string): Promise<string> {
    const stored = this.objects.get(key);
    if (!stored) {
      return Promise.resolve('');
    }
    return Promise.resolve(
      `data:${stored.contentType};base64,${stored.body.toString('base64')}`
    );
  }

  /** Tests only. */
  has(key: string): boolean {
    return this.objects.has(key);
  }

  /** Tests only. */
  get size(): number {
    return this.objects.size;
  }
}

/* ------------------------------------------------------------------ *
 * FACTORY
 * ------------------------------------------------------------------ */

let store: ObjectStore | undefined;

/**
 * Pick an implementation once, from configuration.
 *
 * Memoised, so the S3 client and its credential chain are built a single time
 * rather than per upload.
 */
export function getObjectStore(): ObjectStore {
  if (store) return store;

  const configured =
    env.storageEndpoint !== '' &&
    env.storageBucket !== '' &&
    env.storageAccessKeyId !== '' &&
    env.storageSecretAccessKey !== '';

  if (!configured) {
    // Fail at startup, not at the first upload. An in-memory store in
    // production drops every photo on restart, which would silently empty the
    // moderator queue and leave challenged students unable to clear themselves
    // — a failure that looks like nothing at all until somebody complains.
    if (env.isProduction) {
      throw new Error(
        'STORAGE_* is not configured. Gender-challenge photos cannot be stored in production.'
      );
    }
    store = new InMemoryObjectStore();
    return store;
  }

  store = new S3ObjectStore(env.storageBucket);
  return store;
}

/** Tests only. */
export function setObjectStore(replacement: ObjectStore | undefined): void {
  store = replacement;
}
