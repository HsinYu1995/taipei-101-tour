/**
 * The lift's doors, one look drawn two ways: as page panels over the 5F-to-89F crossing (Fade) and as a shader over
 * the mall's floor changes (MallScene). Two steel panels slide in from the sides, shaded from `edge` at the bottom to
 * `steel` at the top, and meet in a `seamPx` line of `edge`.
 */
export const DOORS = { steel: '#D9D6CF', edge: '#A9A59C', seamPx: 2 } as const;
