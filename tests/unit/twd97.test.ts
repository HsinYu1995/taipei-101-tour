import { expect, test } from 'vitest';
import { toTwd97 } from '../../src/geo/twd97';

// Reference values from proj4 2.15 with EPSG:3826 (+proj=tmerc +lon_0=121 +k=0.9999 +x_0=250000 +ellps=GRS80).
test.each([
  { lat: 25.033611, lon: 121.565, e: 307016.17, n: 2769619.346 },
  { lat: 25.128, lon: 121.741, e: 324720.202, n: 2780160.381 },
  { lat: 22, lon: 120.2, e: 167396.597, n: 2433773.136 },
])('($lat, $lon) projects to TWD97 within a millimetre', ({ lat, lon, e, n }) => {
  const p = toTwd97(lat, lon);
  expect(Math.abs(p.e - e)).toBeLessThan(0.001);
  expect(Math.abs(p.n - n)).toBeLessThan(0.001);
});
