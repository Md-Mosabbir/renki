import { afterEach, describe, expect, it, vi } from 'vitest';

import { QRVerification, Verification } from '../models/qr-verification.model.js';
import { generateCode, scanCode } from './qr-verification.service.js';

/**
 * Tests for the QR verification portal.
 *
 * These are true unit tests: the model and service touch no database, so they
 * need no fixtures and no live Postgres. That is a property of how the code was
 * written, not luck — the moment persistence lands, tests that exercise it
 * become integration tests and belong somewhere else.
 */

const HOUR = 60 * 60 * 1000;

/** A portal expiring one hour from now, with no code yet. */
function makePortal(expiresInMs = HOUR): QRVerification {
  return new QRVerification(
    '60000000-0000-0000-0000-000000000001',
    new Date(Date.now() + expiresInMs)
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('QRVerification', () => {
  it('is not valid before a code has been generated', () => {
    // The portal exists as soon as the group does, but scanning it must fail
    // until someone actually mints a code for it.
    expect(makePortal().isValid()).toBe(false);
  });

  it('is valid once a code exists and the expiry has not passed', () => {
    const portal = makePortal();
    generateCode(portal);
    expect(portal.isValid()).toBe(true);
  });

  it('is not valid after the expiry passes', () => {
    const portal = makePortal();
    generateCode(portal);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 2 * HOUR));

    expect(portal.isValid()).toBe(false);
  });

  it('is not valid at the exact moment of expiry', () => {
    // The comparison is `new Date() < expiresAt`, so the expiry instant itself
    // is already too late. Worth pinning down: an off-by-one here is the kind
    // of thing that only ever misbehaves for one millisecond a day.
    const expiresAt = new Date(Date.now() + HOUR);
    const portal = new QRVerification('60000000-0000-0000-0000-000000000001', expiresAt);
    generateCode(portal);

    vi.useFakeTimers();
    vi.setSystemTime(expiresAt);

    expect(portal.isValid()).toBe(false);
  });

  it('gives every portal its own id', () => {
    expect(makePortal().id).not.toBe(makePortal().id);
  });

  it('verify() reports the same answer as isValid()', () => {
    // verify() is the abstract contract inherited from Verification; isValid()
    // is this subclass's own name for it. They must not drift apart.
    const portal = makePortal();
    expect(portal.verify()).toBe(portal.isValid());

    generateCode(portal);
    expect(portal.verify()).toBe(portal.isValid());
    expect(portal.verify()).toBe(true);
  });

  it('is a Verification', () => {
    expect(makePortal()).toBeInstanceOf(Verification);
  });
});

describe('generateCode', () => {
  it('stores the code on the portal and returns the same value', () => {
    const portal = makePortal();
    const returned = generateCode(portal);

    // toBe, not toEqual: these must be the same string, not merely equal ones.
    expect(returned).toBe(portal.code);
    expect(returned).not.toBe('');
  });

  it('fits the qr_verifications.code column', () => {
    // 08_qr_verifications.sql declares code VARCHAR(64). 32 random bytes in
    // base64url is 43 characters, so there is headroom — but if anyone raises
    // the byte count to 48 this test fails before Postgres does.
    expect(generateCode(makePortal()).length).toBeLessThanOrEqual(64);
  });

  it('produces url-safe output only', () => {
    // base64url, not base64: the code ends up in a QR payload and potentially a
    // URL, where + / and = all need escaping.
    expect(generateCode(makePortal())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not repeat itself', () => {
    // code is UNIQUE in the schema, so a collision is not a cosmetic problem —
    // it is a failed insert.
    const codes = new Set(Array.from({ length: 100 }, () => generateCode(makePortal())));
    expect(codes.size).toBe(100);
  });

  it('replaces an existing code when called again', () => {
    const portal = makePortal();
    const first = generateCode(portal);
    const second = generateCode(portal);

    expect(second).not.toBe(first);
    expect(portal.code).toBe(second);
  });
});

describe('scanCode', () => {
  const scanner = { id: '10000000-0000-0000-0000-000000000001' };

  it('accepts a scan of a live portal', () => {
    const portal = makePortal();
    generateCode(portal);
    expect(scanCode(portal, scanner)).toBe(true);
  });

  it('rejects a scan of a portal with no code', () => {
    expect(scanCode(makePortal(), scanner)).toBe(false);
  });

  it('rejects a scan after expiry', () => {
    const portal = makePortal();
    generateCode(portal);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 2 * HOUR));

    expect(scanCode(portal, scanner)).toBe(false);
  });

  it('does not yet check who is scanning', () => {
    // Documents a KNOWN GAP, not desired behaviour. scanCode ignores its user
    // argument entirely, so anyone holding the code passes — including someone
    // who is not in the ride group at all.
    //
    // When eligibility lands, this test SHOULD fail. That is the point of it:
    // it is a tripwire, so the gap cannot be forgotten or silently closed.
    const portal = makePortal();
    generateCode(portal);

    const stranger = { id: '10000000-0000-0000-0000-000000000004' };
    expect(scanCode(portal, stranger)).toBe(true);
  });
});
