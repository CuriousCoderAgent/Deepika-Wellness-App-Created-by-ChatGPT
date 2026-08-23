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
    mod = typeof required?.getCurrentPositionAsync === "function" ? required : null;
  } catch {
    mod = null;
  }
  return mod;
}

export function locationIsAvailable(): boolean {
  return locationModule() !== null;
}

export type LocationResult =
  | { status: "ok"; cell: GeoCell }
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
    return cell ? { status: "ok", cell } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
