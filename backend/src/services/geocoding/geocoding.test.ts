import { describe, expect, it } from 'vitest';

import { CachingGeocoderProxy } from './caching.geocoder.proxy.js';
import type { Coordinates, Geocoder, Place } from './geocoder.js';
import { shortAddress, toPlace } from './nominatim.adapter.js';
import {
  MIN_INTERVAL_MS,
  RateLimitedGeocoderProxy,
} from './rate-limited.geocoder.proxy.js';

/** Counting fake — proves proxy behaviour without network. */
class CountingGeocoder implements Geocoder {
  calls = 0;

  constructor(
    private readonly reverseAnswer = 'Test',
    private readonly searchAnswer: Place[] = []
  ) {}

  reverse(_point: Coordinates): Promise<string> {
    this.calls += 1;
    return Promise.resolve(this.reverseAnswer);
  }

  search(_query: string): Promise<Place[]> {
    this.calls += 1;
    return Promise.resolve(this.searchAnswer);
  }
}

const POINT: Coordinates = { latitude: 23.7461, longitude: 90.3742 };

describe('CachingGeocoderProxy', () => {
  it('calls the inner geocoder once for two identical reverse lookups', async () => {
    const inner = new CountingGeocoder();
    const cached = new CachingGeocoderProxy(inner);

    await cached.reverse(POINT);
    await cached.reverse(POINT);

    expect(inner.calls).toBe(1);
  });

  it('calls the inner geocoder twice for two different points', async () => {
    const inner = new CountingGeocoder();
    const cached = new CachingGeocoderProxy(inner);

    await cached.reverse(POINT);
    await cached.reverse({ latitude: 23.81, longitude: 90.42 });

    expect(inner.calls).toBe(2);
  });

  it('caches search by normalised query', async () => {
    const inner = new CountingGeocoder('ignored', [
      { latitude: 23.75, longitude: 90.37, address: 'Dhanmondi, Dhaka' },
    ]);
    const cached = new CachingGeocoderProxy(inner);

    await cached.search('Dhanmondi');
    await cached.search('  dhanmondi  ');

    expect(inner.calls).toBe(1);
  });
});

describe('RateLimitedGeocoderProxy', () => {
  it('waits at least MIN_INTERVAL_MS between sequential calls', async () => {
    const inner = new CountingGeocoder();
    const limited = new RateLimitedGeocoderProxy(inner);

    const start = Date.now();
    await limited.reverse(POINT);
    await limited.reverse(POINT);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(MIN_INTERVAL_MS - 50);
  });
});

describe('NominatimAdapter translation', () => {
  it('turns string lat/lon into numbers', () => {
    const place = toPlace({ lat: '23.7461', lon: '90.3742', name: 'Road 27' });
    expect(place?.latitude).toBe(23.7461);
    expect(place?.longitude).toBe(90.3742);
    expect(typeof place?.address).toBe('string');
  });

  it('trims a six-part display_name to at most two parts', () => {
    const address = shortAddress({
      display_name: '27, Road 27, Dhanmondi, Dhaka, 1209, Bangladesh',
      address: {
        road: 'Road 27',
        suburb: 'Dhanmondi',
        city: 'Dhaka',
        state: 'Bangladesh',
      },
    });

    expect(address).toBe('Road 27, Dhaka');
    expect(address.split(',').length).toBeLessThanOrEqual(2);
  });

  it('returns null for non-numeric coordinates', () => {
    expect(toPlace({ lat: 'nope', lon: '90.3742' })).toBeNull();
  });
});
