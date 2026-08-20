import { describe, expect, it } from 'vitest';

import {
  MINIMUM_AGE_YEARS,
  normalisePhone,
  toPublicUser,
  validateProfileInput,
} from './user.model.js';
import type { UserRow } from './user.model.js';

/**
 * Tests for the onboarding form guard.
 *
 * Everything here arrives from a client and none of it is trustworthy. Most bad
 * values would also be caught by a CHECK constraint, but as a 500 that tells
 * the student nothing — these tests pin the 400 that explains itself.
 */

/** A form submission that passes, so each test can spoil exactly one field. */
function validForm(): Record<string, unknown> {
  return {
    name: 'Nusrat Jahan',
    university: 'North South University',
    gender: 'female',
    dateOfBirth: '2003-04-17',
    phone: '01712345678',
    studentId: '2211545642',
  };
}

describe('normalisePhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['017 1234 5678', '+8801712345678'],
    ['017-1234-5678', '+8801712345678'],
  ])('normalises %s', (input, expected) => {
    // All five are the same phone. Storing them as typed would make
    // uq_users_phone meaningless — five rows, one number, no duplicate error.
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([
    ['01212345678', 'operator digit 2 is not a real prefix'],
    ['0171234567', 'one digit short'],
    ['017123456789', 'one digit long'],
    ['+9101712345678', 'wrong country code'],
    ['not a phone', 'not digits at all'],
    ['', 'empty'],
  ])('rejects %s (%s)', (input) => {
    expect(normalisePhone(input)).toBeNull();
  });
});

describe('validateProfileInput', () => {
  it('accepts a complete form and returns the normalised phone', () => {
    const result = validateProfileInput(validForm());

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.value.phone).toBe('+8801712345678');
    expect(result.value.gender).toBe('female');
  });

  it('trims surrounding whitespace from names', () => {
    const result = validateProfileInput({ ...validForm(), name: '  Rafiul Karim  ' });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.value.name).toBe('Rafiul Karim');
  });

  it('rejects a name that is only whitespace', () => {
    // Trimmed to '' — a length check alone would let three spaces through.
    expect(validateProfileInput({ ...validForm(), name: '   ' }).valid).toBe(false);
  });

  it('rejects a name longer than the column', () => {
    // users.name is VARCHAR(100). Past that Postgres raises 22001, which would
    // surface as a 500 rather than a field-level message.
    const result = validateProfileInput({ ...validForm(), name: 'a'.repeat(101) });
    expect(result.valid).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(validateProfileInput(null).valid).toBe(false);
    expect(validateProfileInput('a string').valid).toBe(false);
  });

  describe('gender', () => {
    it.each(['male', 'female'])('accepts %s', (gender) => {
      expect(validateProfileInput({ ...validForm(), gender }).valid).toBe(true);
    });

    it("rejects 'unspecified' even though the column allows it", () => {
      // chk_users_gender permits 'unspecified' because that is the default a
      // row starts at. It is not a legal ANSWER: gender verification has
      // nothing to check against, and same-gender ride groups cannot place a
      // student who has not picked a side.
      expect(validateProfileInput({ ...validForm(), gender: 'unspecified' }).valid).toBe(
        false
      );
    });

    it('rejects a value the column would refuse', () => {
      expect(validateProfileInput({ ...validForm(), gender: 'banana' }).valid).toBe(
        false
      );
    });
  });

  describe('dateOfBirth', () => {
    it('rejects a date that does not exist', () => {
      // new Date('2005-02-30') does not throw — it rolls forward to 2 March.
      // Only the round-trip comparison catches it.
      const result = validateProfileInput({ ...validForm(), dateOfBirth: '2005-02-30' });
      expect(result.valid).toBe(false);
    });

    it('accepts 29 February in a leap year', () => {
      expect(
        validateProfileInput({ ...validForm(), dateOfBirth: '2004-02-29' }).valid
      ).toBe(true);
    });

    it('rejects a non-ISO format', () => {
      expect(
        validateProfileInput({ ...validForm(), dateOfBirth: '17/04/2003' }).valid
      ).toBe(false);
    });

    it('rejects a future date', () => {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const result = validateProfileInput({
        ...validForm(),
        dateOfBirth: nextYear.toISOString().slice(0, 10),
      });
      expect(result.valid).toBe(false);
    });

    it(`rejects someone under ${String(MINIMUM_AGE_YEARS)}`, () => {
      const tooYoung = new Date();
      tooYoung.setFullYear(tooYoung.getFullYear() - MINIMUM_AGE_YEARS + 1);
      const result = validateProfileInput({
        ...validForm(),
        dateOfBirth: tooYoung.toISOString().slice(0, 10),
      });

      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.reason).toContain(String(MINIMUM_AGE_YEARS));
    });

    it(`accepts someone who turned ${String(MINIMUM_AGE_YEARS)} today`, () => {
      // The boundary itself. Computed by calendar year rather than by dividing
      // elapsed milliseconds, because leap years make that arithmetic wrong for
      // birthdays within a day of the cutoff.
      const exactly = new Date();
      exactly.setFullYear(exactly.getFullYear() - MINIMUM_AGE_YEARS);
      const result = validateProfileInput({
        ...validForm(),
        dateOfBirth: exactly.toISOString().slice(0, 10),
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('studentId', () => {
    it('rejects a non-numeric id', () => {
      expect(validateProfileInput({ ...validForm(), studentId: '22A1545' }).valid).toBe(
        false
      );
    });

    it('rejects one that is too short', () => {
      expect(validateProfileInput({ ...validForm(), studentId: '221' }).valid).toBe(
        false
      );
    });
  });

  it('reports one problem at a time', () => {
    // Every field is wrong; the student gets a single reason. Worth knowing
    // when wiring the form: it cannot highlight all bad fields at once.
    const result = validateProfileInput({
      name: '',
      university: '',
      gender: 'banana',
      dateOfBirth: 'nope',
      phone: 'nope',
      studentId: 'nope',
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toContain('name');
  });
});

describe('toPublicUser', () => {
  function row(overrides: Partial<UserRow> = {}): UserRow {
    return {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Nusrat Jahan',
      email: 'nusrat@northsouth.edu',
      google_id: '113586204917403948271',
      profile_picture_url: null,
      id_card_image_url: null,
      gender: 'female',
      university: 'North South University',
      created_at: new Date('2026-01-01T00:00:00Z'),
      trust_stage: 'new',
      qr_token: 'a-live-scan-credential',
      qr_token_expires_at: new Date('2026-01-01T01:00:00Z'),
      date_of_birth: new Date(2003, 3, 17),
      phone: '+8801712345678',
      student_id: '2211545642',
      profile_completed_at: null,
      ...overrides,
    };
  }

  it('never leaks the QR token', () => {
    // qr_token is a live credential — whoever holds it can complete a scan.
    // Dropped here rather than filtered per endpoint, so a new endpoint cannot
    // forget to.
    const publicUser = toPublicUser(row());
    expect(Object.values(publicUser)).not.toContain('a-live-scan-credential');
    expect(publicUser).not.toHaveProperty('qr_token');
    expect(publicUser).not.toHaveProperty('qrToken');
  });

  it('reports an unfinished profile as incomplete', () => {
    expect(toPublicUser(row()).profileCompleted).toBe(false);
  });

  it('reports a finished profile as complete', () => {
    const finished = row({ profile_completed_at: new Date('2026-02-01T10:00:00Z') });
    expect(toPublicUser(finished).profileCompleted).toBe(true);
  });

  it('does not shift the birth date across a day boundary', () => {
    // Dhaka is UTC+06, so a DATE read back as local midnight would render as
    // the PREVIOUS day through toISOString(). Formatting local parts avoids it.
    expect(toPublicUser(row()).dateOfBirth).toBe('2003-04-17');
  });
});
