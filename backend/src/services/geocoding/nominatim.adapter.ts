import type { Coordinates, Geocoder, Place } from './geocoder.js';

/**
 * ADAPTER — OpenStreetMap Nominatim → Geocoder.
 *
 * The only file allowed to know what Nominatim returns. Translation work:
 *   lat/lon strings → numbers
 *   display_name (six parts) → address (at most two)
 *   HTTP errors → '' / [] (never throw)
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org';
const DHAKA_VIEWBOX = '90.30,23.68,90.53,23.92';
const FETCH_TIMEOUT_MS = 8000;

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  state_district?: string;
  state?: string;
}

/** Nominatim's shape — private to this adapter. */
export interface NominatimPlace {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

export class NominatimAdapter implements Geocoder {
  async reverse(point: Coordinates): Promise<string> {
    try {
      const url =
        `${ENDPOINT}/reverse?format=jsonv2` +
        `&lat=${String(point.latitude)}&lon=${String(point.longitude)}` +
        `&zoom=18&addressdetails=1`;

      const data = (await fetchJson(url)) as NominatimPlace | null;
      return data ? shortAddress(data) : '';
    } catch {
      return '';
    }
  }

  async search(query: string): Promise<Place[]> {
    const trimmed = query.trim();
    if (trimmed === '') return [];

    try {
      const url =
        `${ENDPOINT}/search?format=jsonv2` +
        `&q=${encodeURIComponent(trimmed)}` +
        `&limit=6&addressdetails=1` +
        `&viewbox=${DHAKA_VIEWBOX}&bounded=0&countrycodes=bd`;

      const data = (await fetchJson(url)) as NominatimPlace[] | null;
      if (!Array.isArray(data)) return [];
      return data.map(toPlace).filter((place): place is Place => place !== null);
    } catch {
      return [];
    }
  }
}

/** Exported for unit tests — proves translation without hitting the network. */
export function shortAddress(place: NominatimPlace): string {
  const address = place.address ?? {};

  const specific =
    place.name?.trim() ||
    address.road ||
    address.neighbourhood ||
    address.quarter ||
    address.suburb ||
    '';

  const city =
    address.city ?? address.town ?? address.state_district ?? address.state ?? '';

  const parts = [specific, city].map((part) => part.trim()).filter((part) => part !== '');
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return unique.join(', ');
}

/** String lat/lon → Renki Place with a trimmed address. */
export function toPlace(raw: NominatimPlace): Place | null {
  const latitude = Number(raw.lat);
  const longitude = Number(raw.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, address: shortAddress(raw) };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Nominatim policy: identify the application.
        'User-Agent':
          'Renki/1.0 (university ride-sharing; contact: renki@northsouth.edu)',
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
