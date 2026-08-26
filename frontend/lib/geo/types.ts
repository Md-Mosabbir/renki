/**
 * The shape of a geocoder, independent of who provides it.
 *
 * This exists so the map provider is a swap and not a rewrite. Today it is
 * OpenStreetMap because OSM needs no account, no key and no billing card, which
 * is the only reason a map shipped at all. When the Adapter lands it implements
 * this interface and `lib/geo/index.ts` changes on one line.
 *
 * The one rule worth stating: NOTHING HERE MAY THROW.
 *
 * A geocoder is a convenience — it turns a pin into a name. Renki does not need
 * the name: `POST /api/rides/request` takes coordinates and `resolveDestination`
 * computes the H3 cell from those alone. So a geocoder that is down, rate
 * limited, or simply wrong about a corner of Dhaka must degrade to "unnamed
 * pin", never to "you cannot search for a ride". Every method below returns an
 * empty result instead of rejecting, and the callers are written on that basis.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Place extends GeoPoint {
  /**
   * A short human label, at most two comma-separated parts.
   *
   * Two parts, because the backend splits on the final comma: everything before
   * it becomes the card's label and the last part becomes the area. Sending
   * Nominatim's raw `display_name` ("27, Road 27, Dhanmondi, Dhaka, 1209,
   * Bangladesh") would put five parts in the label and "Bangladesh" in the
   * area, on every swipe card. See `labelOf` in candidate-query.ts and the
   * matching split in location.service.ts.
   *
   * Empty when the lookup failed, which is a legal state — see the note above.
   */
  address: string;
}

export interface GeoProvider {
  /** A pin's coordinates to a human name. Returns '' if it cannot say. */
  reverseGeocode(point: GeoPoint): Promise<string>;

  /**
   * Free text to candidate places. Returns [] if it cannot say.
   *
   * Deliberately NOT an autocomplete. Nominatim's usage policy forbids
   * per-keystroke queries, so callers must submit on Enter or a button — see
   * the rate limiter in nominatim.ts.
   */
  search(query: string): Promise<Place[]>;
}
