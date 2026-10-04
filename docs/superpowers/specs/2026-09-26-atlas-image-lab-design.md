# ATLAS Image Lab Design

Status: Approved for implementation
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Owner: ATLAS Studio / Creator
Primary route: `/studio/create?type=image`

## Purpose

Turn the existing Image Lab entrypoint into a real, governed image-editing workspace for ATLAS. Users can upload a source image, mark edit points or regions, add edit instructions, protect faces/identity, choose format, and submit an edit only when a verified executable image engine is ready.

## Architecture

Keep Image Lab inside the existing Creator module. Add a focused `ImageLabWorkspace` for image mode and keep video routed to ATLAS Director. Reuse authenticated Creator APIs, tenant scope, Creator permissions, audit, provider readiness, and Creator Library.

## User flow

1. Upload one image (JPEG/PNG/WebP).
2. Preview it in-browser.
3. Click the preview to add numbered edit points.
4. Attach an instruction to each point or add a global instruction.
5. Mark faces/identity as protected via an explicit preserve-identity constraint.
6. Select output aspect ratio and visibility.
7. Submit only if an executable image engine is verified.
8. If no engine is verified, fail closed and allow prompt-package export instead.
9. Returned media is treated as an asset only after server persistence succeeds.

## Contracts

- Maximum upload size: 15 MiB.
- Accepted MIME types: image/jpeg, image/png, image/webp.
- Coordinates are normalized to 0..1 so annotations survive responsive rendering.
- A generation request contains source image, normalized edit points, global instruction, preserveIdentity flag, aspectRatio, and visibility.
- Client never labels an edit generated until the server returns a persisted asset.
- Provider/engine readiness remains truthful and fail-closed.
- No paid fallback is silently selected.
- Creator Library remains the destination for persisted output.

## Public surface

This implementation targets the authenticated Image Lab first. A public $1 workflow can reuse the same contracts later without duplicating the editor or generation core.

## Testing

Integration tests cover upload validation, annotation coordinates, identity-preservation payload, fail-closed generation, and prompt export fallback.
