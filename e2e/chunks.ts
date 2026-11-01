import { readFileSync } from 'node:fs';

/** One entry of Vite's build manifest (dist/.vite/manifest.json). */
interface Chunk {
  file: string;
  imports?: string[];
  css?: string[];
  assets?: string[];
}

/** A lazily loaded scene, by its source path in the manifest. */
export type LazyScene = 'src/street/StreetScene.tsx' | 'src/mall/MallScene.tsx';
export const STREET_SCENE: LazyScene = 'src/street/StreetScene.tsx';
export const MALL_SCENE: LazyScene = 'src/mall/MallScene.tsx';

/** Every file `key` loads: its chunk, its static imports' chunks, and their stylesheets and assets. */
function closure(manifest: Record<string, Chunk>, key: string, out = new Set<string>()): Set<string> {
  const chunk = manifest[key];
  if (!chunk || out.has(chunk.file)) return out;
  out.add(chunk.file);
  for (const f of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) out.add(f);
  for (const i of chunk.imports ?? []) closure(manifest, i, out);
  return out;
}

/**
 * The files under dist/assets that loading `scene` fetches beyond what the first load already has, however the
 * build splits them: a chunk shared by both scenes counts for each. Read from the build each call, since the
 * build runs after the test files are loaded.
 */
export function lazyFiles(scene: LazyScene): string[] {
  const manifest: Record<string, Chunk> = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
  const first = closure(manifest, 'index.html');
  return [...closure(manifest, scene)].filter((f) => !first.has(f)).map((f) => f.replace(/^assets\//, ''));
}

/** Whether a request URL fetches one of `files` (as lazyFiles names them). */
export const fetchesAny = (files: readonly string[]) => (url: string | URL) => {
  const path = new URL(url).pathname;
  return files.some((f) => path === `/assets/${f}`);
};
