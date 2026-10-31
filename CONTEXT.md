# Context

Domain language for the Taipei 101 tour. Use these words in code, docs and conversation.

## Tour

- **Tour**: the scroll-driven camera journey through the chapters.
- **Chapter**: one part of the tour (basin, tower, damper, observatory); each has a **stop** where scrolling pauses.
- **Explore**: bounded orbit/zoom at a stop, entered by a drag or the Explore button.

## Street walk

- **Street walk**: walking the Xinyi streets at eye level, entered by zooming in past the tower chapter's closest explore distance. Its modes are descending, walking and ascending (shared by every place of the walk).
- **Visitor**: the person the user walks as during the street walk. Not "player" or "camera".
- **Crowd**: the people who walk a place: pedestrians on the street's footways and zebra crossings, shoppers on each mall floor (each floor has its own crowd; some sit at tables or queue).
- **Traffic**: the scooters riding the car roads.
- **Street simulation**: everything that moves on the street (visitor, crowd, traffic) and what blocks it (buildings, the 101 podium and tower base, tree trunks, the walk area edge), advanced together by one step in a fixed order: visitor, then crowd, then traffic. It is told its phase each frame: paused unless the walk is on the street, still during the descent and ascent (everyone but the visitor moves), walking when the visitor has control.

## Walk

- **Walk**: walking at eye level with the walk controls (keys or thumbstick, drag to look). One lifecycle, used by every place. Entered from the tower chapter's stop (onto the street), and from the view chapter's stop onto the observatory once that is built (planned, M4); each Escape steps back one place toward the tour.
- **Place**: somewhere the visitor can walk: the street (Xinyi), the mall (inside 101) and, planned for M4, the observatory (89F). Each has its own simulation and its own exits.
- **Crossing**: moving the visitor between places, or from the mall to the damper chapter, behind a short fade to black.
- **Mall**: the 101 shopping mall, floors B1 to 5F, entered on foot from the street through 101's south entrance.
- **Floor**: one mall level, with its real tenants and its own character (centrepiece, mood, crowd).
- **Floor panel**: the on-screen buttons that move the visitor between floors; on 5F it also offers the lift.
- **Lift**: the observatory express lift from the 5F ticket hall up to the observatory. Until the observatory is built, taking it ends the walk at the damper chapter.
- **Observatory** (planned, M4; not yet a place): the 89F observatory floor, to be a place of the walk: a ring of floor round the tower core, glass all round, the damper visible in the middle. The damper and view chapters are tour stops looking at the same floor (owner, 2026-10-30).
- **Tenant**: a shop, restaurant or stall with a frontage on a floor, from the official 101 listing.
- **Sign**: the name over a tenant's shopfront, in lettering that echoes the brand, never its logo. In Latin script when the brand has an official Latin name, otherwise in Chinese.
