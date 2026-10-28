# Context

Domain language for the Taipei 101 tour. Use these words in code, docs and conversation.

## Tour

- **Tour**: the scroll-driven camera journey through the chapters.
- **Chapter**: one part of the tour (basin, tower, damper, observatory); each has a **stop** where scrolling pauses.
- **Explore**: bounded orbit/zoom at a stop, entered by a drag or the Explore button.

## Street walk

- **Street walk**: walking the Xinyi streets at eye level, entered by zooming in past the tower chapter's closest explore distance. Its modes are descending, walking and ascending (shared by every place of the walk).
- **Visitor**: the person the user walks as during the street walk. Not "player" or "camera".
- **Crowd**: the pedestrians walking the footways and zebra crossings.
- **Traffic**: the scooters riding the car roads.
- **Street simulation**: everything that moves on the street (visitor, crowd, traffic) and what blocks it (buildings, the 101 podium and tower base, tree trunks, the walk area edge), advanced together by one step in a fixed order: visitor, then crowd, then traffic. It is told its phase each frame: paused unless the walk is on the street, still during the descent and ascent (everyone but the visitor moves), walking when the visitor has control.

## Walk

- **Walk**: walking at eye level with the walk controls (keys or thumbstick, drag to look). One lifecycle, used by every place.
- **Place**: somewhere the visitor can walk: the street (Xinyi) or the mall (inside 101). Each has its own simulation and its own exits.
- **Mall**: the 101 shopping mall, floors B1 to 5F, entered on foot from the street through 101's south entrance.
- **Floor**: one mall level, with its real tenants and its own character (centrepiece, mood, crowd).
- **Floor panel**: the on-screen buttons that move the visitor between floors, or on to the damper chapter.
