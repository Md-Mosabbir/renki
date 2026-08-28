/**
 * TARGET interface — Renki's view of geocoding, not Nominatim's.
 *
 * Adapter translates OSM's shape into this; Proxies wrap it without changing
 * the contract. If this file starts looking like a Nominatim response, the
 * Adapter has failed.
 *
 * NOTHING HERE MAY THROW. A dead geocoder costs a label, never a ride.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place extends Coordinates {
  /**
   * At most TWO comma-separated parts. `location.service.ts` and
   * `candidate-query.ts` split on the final comma — more parts and swipe cards
   * grow postcodes into the label.
   */
  address: string;
}

export interface Geocoder {
  /** Coordinates → a human name. '' when it cannot say. */
  reverse(point: Coordinates): Promise<string>;
  /** Free text → candidate places. [] when it cannot say. */
  search(query: string): Promise<Place[]>;
}
