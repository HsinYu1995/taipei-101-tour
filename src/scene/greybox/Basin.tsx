import { Suspense } from 'react';
import { SCENE_AREA, isWalkMode } from '../../street/api';
import { useTour } from '../../tour/store';
import { City } from '../city/City';
import { Terrain, useHeightField } from '../terrain/Terrain';

/** How far out procedural blocks are drawn while walking the street. */
const STREET_CITY_REACH = 3000;

function Ground() {
  const field = useHeightField();
  // Once the street walk has loaded, its own ground and buildings replace the terrain and blocks under Xinyi.
  const streetLoaded = useTour((s) => s.places.street !== undefined);
  // At street level, blocks past this distance are lost in the haze but still cost triangles.
  const walking = useTour((s) => isWalkMode(s.mode));
  return (
    <>
      <Terrain field={field} hole={streetLoaded ? SCENE_AREA : null} />
      <City field={field} hole={streetLoaded ? SCENE_AREA : null} reach={walking ? STREET_CITY_REACH : Infinity} />
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
