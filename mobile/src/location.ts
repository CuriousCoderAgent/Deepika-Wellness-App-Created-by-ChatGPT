/**
 * Asking for a location, and destroying most of it before it leaves.
 *
 * The app can connect members who are actually near each other, which needs a
 * position. It does not need an accurate one, and an accurate one is a liability
 * — these are women who log when and where they exercise.
 *
 * So the coarsening happens here, on the device, before anything is sent. What
 * leaves the phone is two integers naming a roughly three-kilometre square. The
 * server never receives a coordinate, which means there is no coordinate for it
 * to store, log, leak, or be compelled to produce.
 *
 * Balanced accuracy is requested deliberately rather than the highest available:
 * asking for precision we are about to throw away would drain her battery to
 * produce a number we do not want.
 */

import { toCell, type GeoCell } from "./proximity";

interface LocationModule {
  requestForegroundPermissionsAsync: () => Promise<{ granted: boolean }>;
  getCurrentPositionAsync: (options?: {
    accuracy?: number;
  }) => Promise<{ coords: { latitude: number; longitude: number } }>;
  reverseGeocodeAsync?: (coords: {
    latitude: number;
    longitude: number;
  }) => Promise<
    {
      district?: string | null;
      subregion?: string | null;
      city?: string | null;
      region?: string | null;
    }[]
  >;
  Accuracy?: { Balanced?: number };
}

let resolved = false;
let mod: LocationModule | null = null;

/** Required lazily: a build without the native module should degrade, not die. */
function locationModule(): LocationModule | null {
  if (resolved) return mod;
  resolved = true;
  try {
    const required = require("expo-location");
    mod =
      typeof required?.getCurrentPositionAsync === "function" ? required : null;
  } catch {
    mod = null;
  }
  return mod;
}

export function locationIsAvailable(): boolean {
  return locationModule() !== null;
}

export type LocationResult =
  | {
      status: "ok";
      cell: GeoCell;
      /**
       * A human-readable name for where she is, for showing her on her own
       * screen — "Jayanagar, Bengaluru" rather than two integers.
       *
       * Local only, and deliberately not part of what is sent. A
       * neighbourhood name is far more precise than the 3km cell it sits in,
       * so uploading it would give away exactly what the coarsening exists to
       * protect. It is here so she can check the app read her correctly
       * before she agrees to share anything.
       */
      label?: string;
    }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * Ask once, and return a cell or nothing.
 *
 * Never returns coordinates to the caller, so no other part of the app can
 * accidentally store or send them.
 */
export async function currentCell(): Promise<LocationResult> {
  const location = locationModule();
  if (!location) return { status: "unavailable" };
  try {
    const permission = await location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { status: "denied" };
    const position = await location.getCurrentPositionAsync({
      accuracy: location.Accuracy?.Balanced,
    });
    const cell = toCell(position.coords.latitude, position.coords.longitude);
    if (!cell) return { status: "unavailable" };
    return {
      status: "ok",
      cell,
      label: await describe(location, position.coords),
    };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Name the place, on the device, for her eyes only.
 *
 * expo-location resolves this through the platform geocoder, so the
 * coordinates go to the OS rather than to us or to a web service. Failure is
 * fine and common — no geocoder on the device, no network, an unnamed area —
 * and simply means she is shown the area without a name.
 */
async function describe(
  location: LocationModule,
  coords: { latitude: number; longitude: number },
): Promise<string | undefined> {
  if (typeof location.reverseGeocodeAsync !== "function") return undefined;
  try {
    const [place] = await location.reverseGeocodeAsync(coords);
    if (!place) return undefined;
    const area = place.district || place.subregion;
    const town = place.city || place.region;
    const parts = [area, town].filter(
      (part): part is string => Boolean(part) && area !== town,
    );
    return parts.length ? parts.join(", ") : (town ?? area ?? undefined);
  } catch {
    return undefined;
  }
}
