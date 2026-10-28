# Context

Domain language for the Taipei 101 tour. Use these words in code, docs and conversation.

## Tour

- **Tour**: the scroll-driven camera journey through the chapters.
- **Chapter**: one part of the tour (basin, tower, damper, observatory); each has a **stop** where scrolling pauses.
- **Explore**: bounded orbit/zoom at a stop, entered by a drag or the Explore button.

## Street walk

- **Street walk**: walking the Xinyi streets at eye level, entered by zooming in past the tower chapter's closest explore distance. Its modes are descending, street and ascending.
- **Visitor**: the person the user walks as during the street walk. Not "player" or "camera".
- **Crowd**: the pedestrians walking the footways and zebra crossings.
- **Traffic**: the scooters riding the car roads.
- **Street simulation**: everything that moves on the street (visitor, crowd, traffic) and what blocks it (buildings, the 101 podium and tower base, tree trunks, the walk area edge), advanced together by one step in a fixed order: visitor, then crowd, then traffic. It runs only during the street walk and is paused otherwise.
