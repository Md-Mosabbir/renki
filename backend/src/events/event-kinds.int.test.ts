import { beforeEach, describe, expect, it } from 'vitest';

import { query } from '../db/pool.js';
import { makeUser, resetDb } from '../test/harness.js';
import { eventBus, EVENT_KIND, registerSubscribers } from './index.js';
import type { DomainEventName } from './index.js';

describe('every declared event reaches the notification table', () => {
  beforeEach(async () => {
    await resetDb();
    eventBus.clear();
    registerSubscribers();
  });

  it('publishes all ten kinds without a CHECK violation', async () => {
    const actor = await makeUser();
    const listener = await makeUser();

    const names = Object.keys(EVENT_KIND) as DomainEventName[];
    expect(names).toHaveLength(10);

    for (const name of names) {
      await eventBus.publish({ name, actorId: actor.id, audience: [listener.id] });
    }

    const { rows } = await query<{ kind: string }>(
      `SELECT kind FROM notifications WHERE user_id = $1 ORDER BY kind`,
      [listener.id]
    );

    expect(rows.map((r) => r.kind).sort()).toEqual(Object.values(EVENT_KIND).sort());
  });
});
