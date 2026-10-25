import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/** One texture tile covers this many metres each way: two 4.2 m floors and four 2.1 m mullion bays. */
export const TILE_METRES = 8.4;
const FLOORS = 2;
const BAYS = 4;

/**
 * Blue-green glass with a lighter spandrel band at every floor and thin mullions, drawn in code (no image
 * files). Geometry UVs are in metres, so `repeat` is 1 / TILE_METRES and bands line up with real floors.
 */
export function makeFacadeTexture(glass: { top: string; bottom: string; band: string; mullion: string }) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const floor = size / FLOORS;
  for (let f = 0; f < FLOORS; f++) {
    const y = f * floor;
    const gradient = ctx.createLinearGradient(0, y, 0, y + floor);
    gradient.addColorStop(0, glass.top);
    gradient.addColorStop(1, glass.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, size, floor);
    ctx.fillStyle = glass.band;
    ctx.fillRect(0, y + floor - 10, size, 10);
  }
  ctx.fillStyle = glass.mullion;
  for (let b = 0; b < BAYS; b++) ctx.fillRect((b * size) / BAYS, 0, 3, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / TILE_METRES, 1 / TILE_METRES);
  texture.anisotropy = 4;
  return texture;
}

export const TOWER_GLASS = { top: '#6fa8a3', bottom: '#4f8f8f', band: '#a9cfc9', mullion: '#3d7372' };
