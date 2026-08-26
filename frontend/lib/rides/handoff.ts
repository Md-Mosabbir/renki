/**
 * Handing a matched ride off to whoever actually drives the car.
 *
 * Renki matches people; it does not dispatch vehicles. Once a group is matched
 * somebody has to open a ride-hailing app and call one, and the only thing
 * Renki can usefully do is prefill both ends of the trip so nobody retypes an
 * address in a stairwell.
 *
 * ---- Why a deep link and not the Uber API ----
 *
 * Uber's Ride Request API can book a ride from your own UI, and it requires a
 * partner agreement and OAuth with the `request` scope. That programme has been
 * closed to new small applicants for years, so it is not an option here — this
 * is the whole reason the integration is a URL and not a service.
 *
 * A universal link needs no key, no account, no server and no approval. On a
 * phone with the app installed it opens the app; without it, it falls back to
 * m.uber.com in the browser. That fallback is why this uses `m.uber.com/ul/`
 * rather than the `uber://` scheme — `uber://` fails silently and dead-ends the
 * one screen where somebody is standing at a gate trying to leave.
 *
 * ---- What this deliberately does not do ----
 *
 * It is a HANDOFF, not a booking. Renki never learns whether a car was called,
 * what it cost, or whether it turned up, which is why nothing here writes to the
 * database and why the button says "Open in Uber" rather than "Book".
 *
 * One fare, several riders, and no payment splitting anywhere in Renki: whoever
 * taps this pays the driver and settles up socially. That is a product decision,
 * not an oversight, and the UI says so out loud.
 */

export interface TripEnd {
  latitude: number;
  longitude: number;
  /** Shown in the hailing app so the rider can confirm the pin is right. */
  label: string;
}

export interface Trip {
  pickup: TripEnd;
  dropoff: TripEnd;
}

export interface HandoffProvider {
  id: string;
  label: string;
  /**
   * Whether this link carries the trip, or merely opens the app.
   *
   * Surfaced in the UI on purpose: "opens the app, you type the address" and
   * "both ends already filled in" are very different promises to make to
   * somebody in a hurry, and quietly rendering them as identical buttons is how
   * a student taps the wrong one.
   */
  prefills: boolean;
  href(trip: Trip): string;
}

/**
 * Uber's universal link.
 *
 * The bracketed parameter names are Uber's, not a mistake. `URLSearchParams`
 * percent-encodes the brackets, which Uber accepts.
 */
export const uber: HandoffProvider = {
  id: 'uber',
  label: 'Uber',
  prefills: true,
  href({ pickup, dropoff }: Trip): string {
    const params = new URLSearchParams({
      action: 'setPickup',
      'pickup[latitude]': String(pickup.latitude),
      'pickup[longitude]': String(pickup.longitude),
      'pickup[nickname]': pickup.label,
      'dropoff[latitude]': String(dropoff.latitude),
      'dropoff[longitude]': String(dropoff.longitude),
      'dropoff[nickname]': dropoff.label,
    });
    return `https://m.uber.com/ul/?${params.toString()}`;
  },
};

/**
 * Pathao, which is what most NSU students actually open.
 *
 * There is no documented public deep link, so this cannot prefill anything and
 * says so. It is here rather than omitted because leaving it out would make
 * Renki look like it believes Dhaka runs on Uber. If Pathao ever publishes a
 * link format, this is the only function that changes.
 */
export const pathao: HandoffProvider = {
  id: 'pathao',
  label: 'Pathao',
  prefills: false,
  href(): string {
    return 'https://pathao.com/';
  },
};

/**
 * Google Maps directions — not a hailing app, but the universal fallback.
 *
 * Worth keeping last in the list: it always works, on every device, and it is
 * the thing to open when the other two have let you down.
 */
export const googleMaps: HandoffProvider = {
  id: 'google-maps',
  label: 'Directions',
  prefills: true,
  href({ pickup, dropoff }: Trip): string {
    const params = new URLSearchParams({
      api: '1',
      origin: `${String(pickup.latitude)},${String(pickup.longitude)}`,
      destination: `${String(dropoff.latitude)},${String(dropoff.longitude)}`,
      travelmode: 'driving',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  },
};

export const handoffProviders: readonly HandoffProvider[] = [uber, pathao, googleMaps];
