# ATLAS Browser Session Model

Date: 2026-09-15

## Current boundary

ATLAS browser authentication uses Supabase access and refresh tokens. Token persistence is centralized in `apps/web/src/lib/atlasSessionStorage.ts`; consumers must not access browser storage directly.

The current implementation still persists tokens in browser `localStorage` for compatibility with the existing Supabase clientless session flow. This is **not** equivalent to an HttpOnly cookie architecture: a successful same-origin script injection could read persisted tokens.

## Required controls while this model is active

- Cloudflare Access remains the outer application perimeter.
- The Worker enforces a restrictive Content-Security-Policy and related response headers.
- Supabase RLS/RBAC remains authoritative for tenant data.
- Refresh/access tokens must never be logged, committed, placed in URLs, analytics, or error payloads.
- Session clear removes both access and refresh tokens.
- Any script execution surface must be treated as security-sensitive.

## Target migration

A future session migration may move refresh-token custody to a server/BFF using `Secure`, `HttpOnly`, `SameSite` cookies. That migration requires a real backend session-issuance and CSRF contract, explicit logout/revocation behavior, refresh rotation, Cloudflare/Supabase compatibility tests, and tenant/RBAC regression coverage.

ATLAS must not claim HttpOnly/BFF session protection until that backend contract exists and production evidence verifies it.
