'use client';

import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Crosshair, Search } from 'lucide-react';

import { geo } from '@/lib/geo';
import type { GeoPoint, Place } from '@/lib/geo';
import { Button } from '@/components/ui/button';
import { InlineMark } from '@/components/motion/mark';

/**
 * Drop a pin, get coordinates and a name for them.
 *
 * This is what makes proximity matching reachable from a browser. The API has
 * accepted arbitrary coordinates since the H3 work landed — `resolveDestination`
 * creates the location and computes its cell — but the only way to answer "where
 * are you going" was a <select> of five seeded landmarks kilometres apart. Two
 * landmarks are never in the same k=1 ring, so the H3 strategy could only ever
 * return what an exact-id match would have returned. A dropped pin is what makes
 * Dhanmondi 27 and Dhanmondi 32 two different rides that still find each other.
 *
 * The map is loaded through `next/dynamic` with `ssr: false` because Leaflet
 * reads `window` when its module is evaluated, which on the server is a build
 * error rather than a runtime one.
 */
const MapCanvas = dynamic(() => import('./map-canvas'), {
  ssr: false,
  loading: () => (
    <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-sm">
      Loading map…
    </div>
  ),
});

/** NSU. Where every stranger ride starts, so the sensible thing to look at first. */
const NSU: GeoPoint = { latitude: 23.8156, longitude: 90.4255 };

export interface PinValue extends GeoPoint {
  address: string;
}

export function PinPicker({
  value,
  onChange,
}: {
  value: PinValue | null;
  onChange: (value: PinValue) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [naming, setNaming] = useState(false);
  const [locating, setLocating] = useState(false);

  const point: GeoPoint = value ?? NSU;

  // Guards a late reverse-geocode from overwriting a newer pin. The lookup is
  // serialised behind a 1/second lane, so a fast double-tap genuinely can land
  // its first answer after the second pin was placed.
  const pinSeq = useRef(0);

  const place = useCallback(
    (next: GeoPoint, knownAddress?: string) => {
      const seq = ++pinSeq.current;

      if (knownAddress !== undefined) {
        onChange({ ...next, address: knownAddress });
        return;
      }

      // Show the pin immediately with no name; the name arrives when it
      // arrives, and never blocks starting a search.
      onChange({ ...next, address: '' });
      setNaming(true);
      void geo.reverseGeocode(next).then((address) => {
        setNaming(false);
        if (seq !== pinSeq.current) return;
        if (address !== '') onChange({ ...next, address });
      });
    },
    [onChange]
  );

  const runSearch = useCallback(() => {
    if (query.trim() === '') return;
    setSearching(true);
    void geo.search(query).then((found) => {
      setSearching(false);
      setResults(found);
    });
  }, [query]);

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        place({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // Denied, unavailable, or timed out — all the same to this screen, and
        // none of them worth an error toast. The map still works by tapping.
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [place]);

  return (
    <div className="space-y-3">
      {/* Explicit submit, never per-keystroke: Nominatim's usage policy
          forbids autocomplete-style querying. See lib/geo/nominatim.ts. */}
      <div className="flex gap-2">
        <div className="border-border flex flex-1 items-center gap-2 border-b-2">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                runSearch();
              }
            }}
            placeholder="Search a place, or tap the map"
            aria-label="Search for a destination"
            className="h-11 w-full bg-transparent text-base focus-visible:outline-none"
          />
          {searching && <InlineMark className="text-muted-foreground size-4" />}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={useMyLocation}
          disabled={locating}
          aria-label="Use my current location"
          className="h-11 w-11 shrink-0 rounded-none"
        >
          {locating ? (
            <InlineMark className="size-4" />
          ) : (
            <Crosshair className="size-4" />
          )}
        </Button>
      </div>

      {results.length > 0 && (
        <ul className="border-border divide-border divide-y border-l-2">
          {results.map((result) => (
            <li key={`${String(result.latitude)},${String(result.longitude)}`}>
              <button
                type="button"
                onClick={() => {
                  place(result, result.address);
                  setResults([]);
                  setQuery(result.address);
                }}
                className="hover:bg-muted w-full cursor-pointer px-4 py-2.5 text-left text-sm"
              >
                {result.address === '' ? 'Unnamed place' : result.address}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-border h-64 w-full overflow-hidden border sm:h-80">
        <MapCanvas point={point} onPick={place} />
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm">
          {value === null ? (
            <span className="text-muted-foreground">
              Tap the map to set a destination
            </span>
          ) : value.address !== '' ? (
            value.address
          ) : naming ? (
            <span className="text-muted-foreground">Naming this spot…</span>
          ) : (
            // A pin with no name is still a perfectly good destination: the
            // match is computed from coordinates, not from this string.
            <span className="text-muted-foreground">
              Dropped pin ({value.latitude.toFixed(4)}, {value.longitude.toFixed(4)})
            </span>
          )}
        </p>

        {/* A condition of OSM's tile usage policy, not a courtesy. */}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground shrink-0 text-[11px] hover:underline"
        >
          © OpenStreetMap
        </a>
      </div>
    </div>
  );
}
