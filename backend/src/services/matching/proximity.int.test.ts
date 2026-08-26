import { beforeEach, describe, expect, it } from 'vitest';

import { makeCampus, makeUser, resetDb, soon } from '../../test/harness.js';
import { createRideRequest, dealDeck, swipe } from '../ride-request.service.js';

/**
 * Proximity matching, against a real database.
 *
 * These assert the behaviour that was UNREACHABLE from the browser until the
 * pin picker landed. The UI offered a <select> of five seeded landmarks
 * kilometres apart, so no two of them were ever in the same k=1 ring and the H3
 * strategy could only ever return what an exact-id match would have returned.
 * Every one of these tests would have passed against the old exact-id code,
 * except the first — which is the point of the first.
 */

// Two real places about a kilometre apart in Dhaka. They land in DIFFERENT
// h3 res-8 cells, which is what makes this a test of the ring rather than of
// exact-cell equality.
const DHANMONDI_27 = { latitude: 23.7461, longitude: 90.3742 };
const DHANMONDI_32 = { latitude: 23.7539, longitude: 90.3776 };
const UTTARA = { latitude: 23.8759, longitude: 90.3795 };

describe('stranger matching by proximity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('deals a card for a destination NEAR mine, not only identical to mine', async () => {
    const campus = await makeCampus();
    const a = await makeUser({ gender: 'female' });
    const b = await makeUser({ gender: 'female' });
    const when = soon(45);

    const mine = await createRideRequest(
      a.id,
      { ...DHANMONDI_27, address: 'Dhanmondi 27, Dhaka' },
      when,
      campus
    );
    await createRideRequest(
      b.id,
      { ...DHANMONDI_32, address: 'Dhanmondi 32, Dhaka' },
      when,
      campus
    );

    const deck = await dealDeck(a.id, mine.id);

    expect(deck.candidates).toHaveLength(1);
    expect(deck.candidates[0]?.userId).toBe(b.id);
    // Same ring, different cells — roughly a kilometre.
    expect(deck.candidates[0]?.distanceKm).toBeGreaterThan(0.5);
    expect(deck.candidates[0]?.distanceKm).toBeLessThan(2);
  });

  it('does NOT deal a card for a destination across the city', async () => {
    const campus = await makeCampus();
    const a = await makeUser({ gender: 'female' });
    const b = await makeUser({ gender: 'female' });
    const when = soon(45);

    const mine = await createRideRequest(a.id, { ...DHANMONDI_27 }, when, campus);
    await createRideRequest(b.id, { ...UTTARA }, when, campus);

    const deck = await dealDeck(a.id, mine.id);
    expect(deck.candidates).toHaveLength(0);
  });

  /**
   * The regression named in CLAUDE.md: excluding the whole PAIR once a proposal
   * row existed meant the first swipe hid the card from the second person, so a
   * match could never be completed from the deck at all. Only MY answer may
   * remove a card.
   */
  it('still deals the card to the OTHER person after I have swiped', async () => {
    const campus = await makeCampus();
    const a = await makeUser({ gender: 'female' });
    const b = await makeUser({ gender: 'female' });
    const when = soon(45);

    const mine = await createRideRequest(a.id, { ...DHANMONDI_27 }, when, campus);
    const theirs = await createRideRequest(b.id, { ...DHANMONDI_32 }, when, campus);

    await swipe(a.id, mine.id, theirs.id, true);

    // Mine is gone from my own deck...
    const myDeck = await dealDeck(a.id, mine.id);
    expect(myDeck.candidates).toHaveLength(0);

    // ...but theirs must still show me, or the ride can never be created.
    const theirDeck = await dealDeck(b.id, theirs.id);
    expect(theirDeck.candidates.map((c) => c.userId)).toContain(a.id);
    expect(theirDeck.candidates[0]?.theyAccepted).toBe(true);
  });

  it('creates the ride only on the SECOND yes', async () => {
    const campus = await makeCampus();
    const a = await makeUser({ gender: 'female' });
    const b = await makeUser({ gender: 'female' });
    const when = soon(45);

    const mine = await createRideRequest(a.id, { ...DHANMONDI_27 }, when, campus);
    const theirs = await createRideRequest(b.id, { ...DHANMONDI_32 }, when, campus);

    const first = await swipe(a.id, mine.id, theirs.id, true);
    expect(first.outcome).toBe('waiting');

    const second = await swipe(b.id, theirs.id, mine.id, true);
    expect(second.outcome).toBe('matched');
  });

  describe('the gender rule, where the strictest side wins', () => {
    it('does not pair different genders by default', async () => {
      const campus = await makeCampus();
      const a = await makeUser({ gender: 'female' });
      const b = await makeUser({ gender: 'male' });
      const when = soon(45);

      const mine = await createRideRequest(a.id, { ...DHANMONDI_27 }, when, campus);
      await createRideRequest(b.id, { ...DHANMONDI_32 }, when, campus);

      expect((await dealDeck(a.id, mine.id)).candidates).toHaveLength(0);
    });

    /**
     * The whole rule in one test. An OR would pass the previous test and fail
     * this one, which is why this is the case worth writing down: opening
     * yourself up must never be enough on its own to place you in front of
     * somebody who did not also choose it.
     */
    it('does not pair when only ONE side is open to all', async () => {
      const campus = await makeCampus();
      const open = await makeUser({ gender: 'female', matchOpenToAll: true });
      const closed = await makeUser({ gender: 'male', matchOpenToAll: false });
      const when = soon(45);

      const mine = await createRideRequest(open.id, { ...DHANMONDI_27 }, when, campus);
      await createRideRequest(closed.id, { ...DHANMONDI_32 }, when, campus);

      expect((await dealDeck(open.id, mine.id)).candidates).toHaveLength(0);
    });

    it('pairs different genders when BOTH are open to all', async () => {
      const campus = await makeCampus();
      const a = await makeUser({ gender: 'female', matchOpenToAll: true });
      const b = await makeUser({ gender: 'male', matchOpenToAll: true });
      const when = soon(45);

      const mine = await createRideRequest(a.id, { ...DHANMONDI_27 }, when, campus);
      await createRideRequest(b.id, { ...DHANMONDI_32 }, when, campus);

      const deck = await dealDeck(a.id, mine.id);
      expect(deck.candidates.map((c) => c.userId)).toContain(b.id);
    });
  });
});
