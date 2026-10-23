import type { ChapterId } from '../tour/types';

export const en = {
  chapters: {
    basin: {
      title: 'The Taipei Basin',
      body: 'A city in a bowl of green mountains, with one tower rising above everything else.',
    },
    tower: {
      title: 'Taipei 101',
      body: 'Eight segments of eight floors each, stacked like bamboo and shaped like a pagoda.',
    },
    damper: {
      title: 'The Damper',
      body: 'A 660 tonne golden sphere hangs between floors 87 and 92 to steady the tower in wind and typhoons.',
    },
    view: {
      title: 'The View',
      body: 'From the observatory, the whole basin spreads out below.',
    },
  } satisfies Record<ChapterId, { title: string; body: string }>,
  // Placeholder copy for M1; real text with sources lands in M5.
  hotspots: {
    'basin-101': { title: 'Taipei 101', body: 'Placeholder: the tallest building in the basin, finished in 2004.' },
    'tower-segments': { title: 'Eight segments', body: 'Placeholder: eight is a lucky number, and each segment holds eight floors.' },
    'damper-sphere': { title: 'Tuned mass damper', body: 'Placeholder: the sphere swings against the tower to cancel its sway.' },
    'view-city': { title: 'The city below', body: 'Placeholder: districts, rivers and mountains seen from the observatory.' },
  } as Record<string, { title: string; body: string }>,
  ui: {
    explore: 'Explore',
    backToTour: 'Back to tour',
    close: 'Close',
  },
};
