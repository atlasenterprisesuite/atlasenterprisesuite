# ATLAS Motion Designer

ATLAS Motion Designer extends ATLAS Director inside `/studio/create?type=video` with a provider-neutral editable motion-composition graph.

The canonical source of truth remains `ProductionSpec.motionComposition`. Editing supports layers, transforms, ordering, visibility/lock state, undo/redo, deterministic timeline preview, opacity keyframes/easing, constrained expressions, and responsive desktop/tablet/mobile layouts.

Production validation promotes blocking motion-graph issues into the normal Director review gate. Native rendering remains truthful: when a motion composition is present, render is disabled unless the native readiness response explicitly advertises `motion-composition-v1`, in addition to the existing permission, saved-version, validation, audio and aspect-ratio gates.

External providers and professional applications remain optional adapters. They never become the ATLAS source of truth and tests/editing do not consume external generation credits.
