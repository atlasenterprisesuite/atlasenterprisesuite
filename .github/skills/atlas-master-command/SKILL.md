---
name: atlas-master-command
description: Apply the approved ATLAS image-to-module-to-production implementation sequence to UI and product-reference work.
---

When an image, screenshot, dashboard, app, menu, interface, or design reference is supplied for ATLAS, treat it as a product specification and implementation instruction, not as a background image or mockup substitute.

Follow this order:
IMAGE -> ANALYSIS -> CLASSIFICATION -> EXISTING ATLAS -> ARCHITECTURE -> MODULE -> ROUTE -> NAVIGATION -> COMPONENTS -> DATA -> PERMISSIONS -> FUNCTIONS -> TESTS -> COMMIT -> DEPLOY -> VERIFICATION.

Reuse stronger existing ATLAS behavior. Do not invent metrics, live connections, provider state, or unsupported functionality. Every visible action must either work through a real implementation or show a truthful unavailable/configuration state.
