import { Suspense } from 'react';
import { City } from '../city/City';
import { Terrain, useHeightField } from '../terrain/Terrain';

function Ground() {
  const field = useHeightField();
  return (
    <>
      <Terrain field={field} />
      <City field={field} />
    </>
  );
}

export function Basin() {
  return (
    <Suspense fallback={null}>
      <Ground />
    </Suspense>
  );
}
