import type { Coordinates, Geocoder, Place } from './geocoder.js';

/**
 * Fake geocoder — no network. Keeps unit/integration tests green without
 * internet, same role as InMemoryObjectStore for STORAGE_*.
 */

const NSU: Place = {
  latitude: 23.8151,
  longitude: 90.4254,
  address: 'NSU, Dhaka',
};

export class MockGeocoder implements Geocoder {
  reverse(_point: Coordinates): Promise<string> {
    return Promise.resolve('Mock Place, Dhaka');
  }

  search(query: string): Promise<Place[]> {
    const trimmed = query.trim();
    if (trimmed === '') return Promise.resolve([]);
    return Promise.resolve([{ ...NSU, address: `${trimmed}, Dhaka` }]);
  }
}
