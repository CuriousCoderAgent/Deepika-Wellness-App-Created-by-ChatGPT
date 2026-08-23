/**
 * "Nearby", without knowing where anyone lives.
 *
 * Members asked to find other people near them, not just in the same city. That
 * is a reasonable thing to want and a dangerous thing to build carelessly: the
 * people using this are women who log when and where they exercise, and a
 * feature that tells a stranger roughly where one of them is, and that she
 * walks each morning, is a different product from the one being asked for.
 *
 * So the location is deliberately destroyed before it is useful for anything
 * except this:
 *
 * - **Coarsened on the device**, to roughly a three-kilometre cell, before it is
 *   ever sent. The server never receives a precise position, so there is nothing
 *   precise for it to leak, log, or be compelled to hand over.
 * - **Stored as a cell, not a coordinate.** What is written to the database is
 *   two integers naming a grid square.
 * - **Reported as a bucket, never a distance.** Someone sees "nearby" or "in
 *   your area". A number in kilometres, sampled a few times as either person
 *   moves, narrows down an address; a bucket does not.
 * - **One point, no history.** The current cell replaces the previous one. There
 *   is no trail, because a trail is the thing worth stealing.
 *
 * Being findable remains off until she turns it on, and turning it off clears
 * the cell rather than hiding it.
 */

/** Roughly three kilometres of latitude. The grid is square in degrees, so
 *  cells are narrower east-west away from the equator — at Indian latitudes a
 *  cell is about 3km × 2.8km, which is close enough for a bucket. */
const CELL_DEGREES = 0.027;

export interface GeoCell {
  /** Grid indices, not coordinates. */
  x: number;
  y: number;
}

/**
 * Snap a position to its cell.
 *
 * Runs on the device. The precise values are discarded here and never sent.
 */
export function toCell(latitude: number, longitude: number): GeoCell | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return {
    y: Math.floor(latitude / CELL_DEGREES),
    x: Math.floor(longitude / CELL_DEGREES),
  };
}

export type Proximity = "same_area" | "nearby" | "further" | "unknown";

/**
 * How close two members are, in words.
 *
 * Chebyshev distance in cells — how many squares apart on the grid. One cell is
 * "same area", within two is "nearby", beyond that is not surfaced at all.
 */
export function proximityBetween(
  a: GeoCell | null | undefined,
  b: GeoCell | null | undefined,
): Proximity {
  if (!a || !b) return "unknown";
  const distance = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  if (distance === 0) return "same_area";
  if (distance <= 2) return "nearby";
  return "further";
}

/** The cells worth querying for someone in this one. */
export function cellsWithin(cell: GeoCell, rings = 2): GeoCell[] {
  const cells: GeoCell[] = [];
  for (let dy = -rings; dy <= rings; dy++) {
    for (let dx = -rings; dx <= rings; dx++) {
      cells.push({ x: cell.x + dx, y: cell.y + dy });
    }
  }
  return cells;
}

export function proximityLabel(proximity: Proximity): string {
  if (proximity === "same_area") return "In your area";
  if (proximity === "nearby") return "Nearby";
  if (proximity === "further") return "Further away";
  return "";
}
