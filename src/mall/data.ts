import { use } from 'react';
import type { MallTenants } from './types';
import tenantsUrl from './tenants.json?url';

let dataPromise: Promise<MallTenants> | undefined;

/** The baked tenant list (scripts/bake-mall.ts), fetched once; suspends until it arrives. */
export function useMallTenants(): MallTenants {
  dataPromise ??= fetch(tenantsUrl).then((res) => {
    if (!res.ok) throw new Error(`mall data: HTTP ${res.status}`);
    return res.json();
  });
  return use(dataPromise);
}
