import { use } from 'react';
import type { XinyiData } from './types';
import xinyiUrl from './xinyi.json?url';

let dataPromise: Promise<XinyiData> | undefined;

/** The baked Xinyi streets (scripts/bake-xinyi.ts), fetched once; suspends until they arrive. */
export function useXinyi(): XinyiData {
  dataPromise ??= fetch(xinyiUrl).then((res) => {
    if (!res.ok) throw new Error(`street data: HTTP ${res.status}`);
    return res.json();
  });
  return use(dataPromise);
}
