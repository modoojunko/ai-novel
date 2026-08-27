# frontend-auth-heal Specification

## Purpose
TBD - created by archiving change 009-frontend-auth-heal. Update Purpose after archive.

## Requirements

### Requirement: 应用启动自愈本地登录态

- The system SHALL provide a `useAuthHeal` hook that on mount issues a single `GET /auth/check-auth` request.
- When the response has `code === 0` and a non-empty token that is not `"dev-token"`, the hook SHALL write the returned token and username into `localStorage` (`auth_token`, `auth_username`).
- When the response indicates not logged in, or the request fails, the hook SHALL NOT clear or modify existing `localStorage` state and SHALL NOT throw or navigate.
- The hook SHALL be invoked once from the application shell (`ClientShell`) so it covers every route, not just `/login`.

#### Scenario: valid backend session heals frontend token
- Given `localStorage` has no `auth_token`, and `GET /auth/check-auth` returns `code: 0` with a valid token and username
- When `useAuthHeal` mounts
- Then `localStorage.auth_token` equals the returned token and `localStorage.auth_username` equals the returned username

#### Scenario: backend not logged in leaves frontend untouched
- Given `localStorage` already has some `auth_token`
- When `GET /auth/check-auth` returns `code: 1` (not logged in) and the hook mounts
- Then the existing `localStorage.auth_token` is unchanged

#### Scenario: network failure is silent
- Given `GET /auth/check-auth` rejects with a network error
- When `useAuthHeal` mounts
- Then no error escapes to the app and `localStorage` is unchanged
