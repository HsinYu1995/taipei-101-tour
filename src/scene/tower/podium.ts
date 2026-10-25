/**
 * The Taipei 101 complex at street level, from OpenStreetMap (© OpenStreetMap contributors, ODbL):
 * the site outline is way 1159328965, projected to TWD97 and placed relative to the tower footprint's centroid
 * (way 198637969), which is the world origin. World axes: east +x, north -z.
 */
export const PODIUM = {
  outline: [
    [-93.9, -97], [-94.9, -37.4], [-95.5, -4.6], [-95.5, -1.4], [-95.6, 2.4], [-95.9, 22.7],
    [-83.9, 22.9], [-83.9, 25.3], [-84, 29.8], [-76.9, 29.9], [-69.6, 30.1], [-69.6, 25.5],
    [-69.5, 23.1], [-57, 23.3], [-56.8, 14], [-32.5, 14.4], [-32.8, 31.6], [-9.9, 31.9],
    [-9.9, 29.8], [-6.4, 29.9], [-6.4, 32.8], [-6.5, 34.3], [-6.6, 42.7], [-0.6, 42.8],
    [5.3, 42.9], [5.5, 34.5], [5.5, 33], [5.6, 30.1], [9, 30.1], [8.9, 32.2],
    [31.6, 32.6], [32, 6.6], [33.9, 6.6], [42.7, 6.8], [42.8, 0.7], [42.9, -5.5],
    [34.1, -5.6], [32.2, -5.6], [32.7, -31.6], [15.5, -31.9], [15.9, -56.4], [25.2, -56.2],
    [25.4, -68.2], [26.9, -68.1], [32.1, -68], [32.3, -75.8], [32.4, -83.3], [27.1, -83.4],
    [25.7, -83.5], [25.9, -95], [5.2, -95.3], [1.6, -95.4], [-1.9, -95.5], [-22.2, -95.8],
    [-22.4, -97.9], [-22.6, -100], [-22.7, -101.6], [-22.1, -103.8], [-25.2, -103.8], [-34.1, -103.9],
    [-42.9, -104.1], [-46.3, -104.2], [-45.8, -102], [-46, -100.4], [-46.2, -98.3], [-46.5, -96.2],
    [-66.4, -96.5], [-70.1, -96.6], [-73.8, -96.7],
  ] as [number, number][],
  /** The mall's OSM height (way 64566862: 6 levels, 30 m). */
  height: 30,
};

/**
 * Rotation about +y (three.js convention) that lines the tower's local x/z axes up with the real building:
 * its OSM footprint's edges run about 0.97 degrees anticlockwise of east in (x, z), so the tower turns by minus that.
 * The Xinyi street grid around it shares the orientation.
 */
export const GRID_ROTATION = (-0.97 * Math.PI) / 180;
