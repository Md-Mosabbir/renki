'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import type { GeoPoint } from '@/lib/geo';

// Leaflet ships its own stylesheet and the map is unusable without it — tiles
// stack vertically and the zoom control renders as bare links.
import 'leaflet/dist/leaflet.css';

/**
 * The Leaflet map itself. NEVER import this directly from a page.
 *
 * Leaflet touches `window` at module scope, so this file cannot be evaluated on
 * the server at all. `pin-picker.tsx` is the only importer and it pulls this in
 * through `next/dynamic` with `ssr: false`. Importing it anywhere else brings
 * back "window is not defined" at build time.
 */

/**
 * A marker drawn in HTML rather than Leaflet's default PNG.
 *
 * The default icon resolves its own image URLs relative to the stylesheet, and
 * every bundler breaks that — the well-known "marker is a broken image" bug,
 * usually patched by reaching into `L.Icon.Default.prototype._getIconUrl`. A
 * `divIcon` sidesteps it: no image assets, nothing to resolve, and it picks up
 * the app's own brand colour instead of Leaflet's blue.
 */
const pinIcon = L.divIcon({
  className: '',
  html: `
    <span style="
      display:block; width:22px; height:22px;
      border-radius:9999px;
      background:var(--brand, #111);
      border:3px solid #fff;
      box-shadow:0 1px 6px rgba(0,0,0,.45);
    "></span>`,
  iconSize: [22, 22],
  // Centre the dot on the coordinate rather than hanging it below-right.
  iconAnchor: [11, 11],
});

/** Turns a tap anywhere on the map into a new pin. */
function ClickToPlace({ onPick }: { onPick: (point: GeoPoint) => void }) {
  useMapEvents({
    click(event) {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

/**
 * Follows the pin when it moves for a reason other than a tap on the map —
 * a search result or "use my location". Without this the pin jumps somewhere
 * off-screen and the map appears not to have reacted at all.
 */
function Recenter({ point }: { point: GeoPoint }) {
  const map = useMap();
  useEffect(() => {
    map.setView([point.latitude, point.longitude], map.getZoom(), { animate: true });
  }, [map, point.latitude, point.longitude]);
  return null;
}

export default function MapCanvas({
  point,
  onPick,
}: {
  point: GeoPoint;
  onPick: (point: GeoPoint) => void;
}) {
  // Only the FIRST value is used, because MapContainer ignores later changes to
  // `center` by design. Recenter above is what handles movement after mount.
  const initialCentre = useMemo<[number, number]>(
    () => [point.latitude, point.longitude],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <MapContainer
      center={initialCentre}
      zoom={15}
      scrollWheelZoom
      className="h-full w-full"
      // Leaflet's own attribution box duplicates the credit rendered beneath
      // the map, where it is legible against the app's background.
      attributionControl={false}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        // Attribution is a condition of OSM's tile usage policy, not a
        // courtesy. Rendered by pin-picker.tsx beneath the map.
        attribution=""
      />
      <ClickToPlace onPick={onPick} />
      <Recenter point={point} />
      <Marker position={[point.latitude, point.longitude]} icon={pinIcon} />
    </MapContainer>
  );
}
