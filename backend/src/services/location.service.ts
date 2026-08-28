import { query } from '../db/database.singleton.js';

/**
 * SERVICE — places a ride can go.
 *
 * `locations` has no `name` column: a row is coordinates plus a free-text
 * `address`. The client wants a label and an area to group by, so both are
 * derived here rather than in a component — a second consumer deriving them
 * differently is how "Gulshan 1 Circle" and "Gulshan 1 Circle, Dhaka" end up
 * in the same dropdown.
 */

export interface LocationRow {
  id: string;
  address: string | null;
  kind: string;
  latitude: number;
  longitude: number;
}

export interface PublicDestination {
  id: string;
  label: string;
  area: string;
  kind: string;
  latitude: number;
  longitude: number;
}

/**
 * "Gulshan 1 Circle, Dhaka" -> label "Gulshan 1 Circle", area "Dhaka".
 *
 * The last comma-separated segment is the city, everything before it is the
 * place. An address with no comma is its own label and has no area.
 */
export function toPublicDestination(row: LocationRow): PublicDestination {
  const address = (row.address ?? '').trim();
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  const area = parts.length > 1 ? (parts.at(-1) ?? '') : '';
  const label =
    parts.length > 1 ? parts.slice(0, -1).join(', ') : (parts[0] ?? 'Unnamed');

  return {
    id: row.id,
    label,
    area,
    kind: row.kind,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/** Campus first — it is the destination most rides share. */
export async function listDestinations(): Promise<LocationRow[]> {
  const { rows } = await query<LocationRow>(
    `SELECT id, address, kind, latitude, longitude
       FROM locations
      ORDER BY CASE kind WHEN 'campus' THEN 0 ELSE 1 END, address`
  );
  return rows;
}
