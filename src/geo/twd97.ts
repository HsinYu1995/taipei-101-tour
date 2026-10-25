/**
 * TWD97 / TM2 zone 121 (EPSG:3826): the grid Taiwan's government geodata uses.
 * GRS80 ellipsoid, central meridian 121°E, scale 0.9999, false easting 250 km.
 */
const A = 6378137;
const F = 1 / 298.257222101;
const K0 = 0.9999;
const LON0 = (121 * Math.PI) / 180;
const FALSE_EASTING = 250000;

const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);

/** Meridian arc length from the equator to latitude `phi` (radians). */
function meridianArc(phi: number) {
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  return (
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

/** WGS84/TWD97 latitude and longitude in degrees to TM2 easting/northing in metres. */
export function toTwd97(latDeg: number, lonDeg: number): { e: number; n: number } {
  const phi = (latDeg * Math.PI) / 180;
  const lam = (lonDeg * Math.PI) / 180;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const nu = A / Math.sqrt(1 - E2 * sin * sin);
  const t = Math.tan(phi) ** 2;
  const c = EP2 * cos * cos;
  const a = (lam - LON0) * cos;
  const e =
    FALSE_EASTING +
    K0 * nu * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120);
  const n =
    K0 *
    (meridianArc(phi) +
      nu *
        Math.tan(phi) *
        ((a * a) / 2 + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  return { e, n };
}
