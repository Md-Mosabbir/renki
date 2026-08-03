import { describe, it, expect } from 'vitest';

import { buildGreeting } from './greeting.service.js';

describe('buildGreeting', () => {
  it('greets a named audience', () => {
    expect(buildGreeting('renki')).toEqual({
      message: 'Hello, renki!',
      audience: 'renki',
      known: true,
    });
  });
});
