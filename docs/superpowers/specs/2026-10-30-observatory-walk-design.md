# 89F observatory walk - design (draft)

Status: being grilled with the owner, 2026-10-30. Decisions are added as they are made.

## Why

The tour's damper and view chapters (M3, M4) are, in the real building, one place: the damper hangs from 92F to 87F and visitors see it from the 88F-89F observatory, which is where the express lift from the mall's 5F ticket hall arrives. The owner wants that floor walkable, like the street and the mall.

## Decisions

- **The observatory is a third place of the walk** (owner, 2026-10-30): the 89F floor, a ring of walkable floor round the tower core, glass all round, the damper visible in the middle, the city outside. The damper and view chapters stay as tour stops for visitors who never walk.
- **Ways in and out** (owner, 2026-10-30):
  - In by the lift from the mall's 5F (a crossing), replacing the interim handover to the damper chapter.
  - In from the view chapter's explore mode by zooming in at its closest distance, or a "Walk the observatory" button, like the street from the tower stop; a short settle to eye height, not a long descent.
  - Out by Escape or zooming out: back to the view chapter's stop in tour mode.
  - Out by the lift down: a button on the observatory's panel crosses back to the mall's 5F lobby.
  - The walk is then a chain with two ends on the tour: tower stop - street - mall - observatory - view stop.
- **Time of day** (owner, 2026-10-30): the observatory walk is always at dusk (low sun, sky turning, the first city lights on, bloom). The view chapter's stop keeps its scroll-driven dusk to night. Light does not carry between places; crossings fade through black and the mall between is indoors.
- **Floors** (owner, 2026-10-30): 89F only. The damper is seen by looking down into the open core from a railing that blocks the visitor, like the mall's balustrade; the core is a void that cannot be walked into.
- **The damper** (owner, 2026-10-30): one damper, one spring, drawn by both the damper chapter and the walk. In the walk it sways gently on its own; pushing it stays a damper chapter interaction (M3), since a drag in the walk means looking.
- **Build order** (owner, 2026-10-30):
  1. Finish the mall walk (plan 2026-10-29, Tasks 5-7); the lift lands at the damper chapter meanwhile.
  2. M3, the damper chapter, with its chamber built as the real 89F core: the damper hanging in the open core, the 89F floor ring and glass round it. The greybox `DamperChamber` goes; nothing is built twice.
  3. M4 and the observatory walk as one milestone: dusk light, city lights and bloom for the view stop and the walk; the observatory place, entry from the view stop, the lift both ways.

## Left for the M4 design

The observatory's panel (lift down, anything else), its crowd, exact geometry, the view stop's relation to the walk's eye height, and how the settle from the view stop feels.

## Future (not in this design)

- 88F (beside the damper's equator) and the 91F outdoor deck, added as floors with a floor panel like the mall's.
- A Day / Dusk / Night control on the observatory's panel (owner, 2026-10-30). If it ever reaches the street, the street needs a night look.
