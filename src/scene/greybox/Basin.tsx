import { Suspense } from 'react';
import { SCENE_AREA } from '../../street/api';
import { useTour } from '../../tour/store';
import { City } from '../city/City';
import { Terrain, useHeightField } from '../terrain/Terrain';

function Ground() {
  const field = useHeightField();
  // Once the street walk has loaded, its own ground replaces the terrain under the Xinyi blocks.
  const streetLoaded = useTour((s) => s.street !== null);
  return (
    <>
      <Terrain field={field} hole={streetLoaded ? SCENE_AREA : null} />
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
