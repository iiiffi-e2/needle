# Frictionless Sign-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace password sign-up with one continue screen for Google, Apple, a Fediverse handle, and an email magic link.

**Architecture:** Supabase Auth stays the session. Google, Apple, and magic links use the Supabase client and the existing `/auth/callback` route. A Fediverse broker proves `username@host` on that server, then mints a Supabase session for a non-deliverable synthetic email. Pure helpers own parsing, redirect safety, host checks, and callback decisions so tests never call a live provider.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth, Vitest

**Spec:** `docs/superpowers/specs/2026-10-08-frictionless-signup-design.md`

## Global Constraints

- `/auth/login` heading is “Welcome back”. `/auth/signup` heading is “Join the party”. Both render the same actions and no password or display-name field.
- Provider order: Google, Apple, Fediverse, then email. Email button label is “Email me a link”.
- Magic-link success copy is “Check your inbox. We sent a link to {email}.” with a “Send again” button. The note does not change based on whether the account exists.
- Error sentences are exactly the spec table. Use straight apostrophes.
- `safeRedirectPath` allows only a single-slash Needle path. Everything else becomes `/rooms`.
- Fediverse scope is `read:accounts`. Outbound calls use HTTPS port 443, `redirect: "manual"`, and an 8 second timeout.
- Refused hosts (local, private, link-local, CGNAT, multicast, `.local`, `.localhost`, `.internal`, `.invalid`, DNS failure) show “That server can’t be used.”
- Synthetic auth email is `fedi.` + lowercase hex SHA-256 of the UTF-8 normalized acct + `@users.needle.invalid`. `public.users.email` stores null for that suffix.
- Fediverse accounts are keyed by `username@host`. A credential email from the server is ignored and must not be passed to `createUser`.
- State cookie `needle_fedi_state` is httpOnly, `SameSite=Lax`, `Path=/auth/fediverse`, `Max-Age=600`. Provider cookie `needle_auth_provider` is `Path=/`, `Max-Age=600`.
- App origin is `NEXT_PUBLIC_APP_URL` without a trailing slash when set, otherwise the request origin. Registration and token exchange use `{origin}/auth/fediverse/callback`.
- Do not call `signUp`, `signInWithPassword`, or `linkIdentity`. Do not add Misskey, WebFinger, password UI, or account-linking settings.

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/lib/auth/safe-redirect.ts` | `safeRedirectPath`, `oauthRedirectTo` |
| `src/lib/auth/auth-errors.ts` | Message table, `authErrorMessage`, `emailSendError`, `callbackErrorCode` |
| `src/lib/auth/fediverse-handle.ts` | `parseFediverseHandle` |
| `src/lib/auth/fediverse-host.ts` | `isBlockedAddress`, `assertPublicHost` |
| `src/lib/auth/fediverse-broker.ts` | App registration, authorize URL, token, credentials, `accountsMatch` |
| `src/lib/auth/fediverse-session.ts` | `fediverseEmail`, `publicEmailForAuthUser`, `establishFediverseSession` |
| `src/lib/auth/fediverse-callback.ts` | State parse and callback plan |
| `src/lib/auth/app-origin.ts` | `resolveAppOrigin` |
| `supabase/migrations/008_fediverse_auth.sql` | Column, app table, trigger |
| `src/components/auth/ContinueForm.tsx` | Shared continue screen |
| `src/app/auth/login/page.tsx` | Login heading |
| `src/app/auth/signup/page.tsx` | Signup heading |
| `src/app/auth/callback/route.ts` | Code exchange plus safe redirect and error codes |
| `src/app/api/auth/fediverse/start/route.ts` | Start route |
| `src/app/auth/fediverse/callback/route.ts` | Fediverse callback |
| `src/app/api/profile/route.ts` | Hide synthetic emails |
| `README.md` | Provider setup |

---

### Task 1: Redirects and error copy

**Files:**
- Create: `src/lib/auth/safe-redirect.ts`
- Create: `src/lib/auth/safe-redirect.test.ts`
- Create: `src/lib/auth/auth-errors.ts`
- Create: `src/lib/auth/auth-errors.test.ts`

**Interfaces:**
- Produces: `safeRedirectPath(input: string | null | undefined): string`
- Produces: `oauthRedirectTo(next: string | null | undefined): string`
- Produces: `AUTH_ERROR_MESSAGES`, `authErrorMessage(code: string | null | undefined): string | null`
- Produces: `emailSendError(message: string): "rate" | "email"`
- Produces: `callbackErrorCode(input: { provider: string | null; hasCode: boolean }): "google" | "apple" | "link" | "auth"`

- [ ] Write failing tests for allowed paths (`/rooms`, `/rooms/a?x=1`), rejected paths (`//evil.com`, `/\evil`, `https://evil.com`, empty, null), and every error sentence.
- [ ] Run `npx vitest run src/lib/auth/safe-redirect.test.ts src/lib/auth/auth-errors.test.ts` and confirm failure.
- [ ] Implement the two modules.
- [ ] Re-run those tests and confirm they pass.

### Task 2: Handle parser and host check

**Files:**
- Create: `src/lib/auth/fediverse-handle.ts`
- Create: `src/lib/auth/fediverse-handle.test.ts`
- Create: `src/lib/auth/fediverse-host.ts`
- Create: `src/lib/auth/fediverse-host.test.ts`

**Interfaces:**
- Produces: `parseFediverseHandle(input: string): { username: string; host: string; acct: string } | null`
- Produces: `isBlockedAddress(address: string): boolean`
- Produces: `assertPublicHost(host: string, lookupFn?: (host: string) => Promise<string[]>): Promise<boolean>`

- [ ] Tests accept `name@server`, `@name@server`, `https://server/@name`, and `https://server/users/name`, including case folding. Tests reject http, a second `@`, an IP host, a query string, and empty input.
- [ ] Host tests: public addresses pass. `127.0.0.1`, `10.1.2.3`, `192.168.1.1`, `172.16.0.1`, `169.254.1.1`, `100.64.0.1`, `localhost`, and `foo.local` fail. A name ending in `.local` does not call lookup.
- [ ] Implement and re-run the new tests.

### Task 3: Broker, session, and callback plan

**Files:**
- Create: `src/lib/auth/fediverse-broker.ts`
- Create: `src/lib/auth/fediverse-broker.test.ts`
- Create: `src/lib/auth/fediverse-session.ts`
- Create: `src/lib/auth/fediverse-session.test.ts`
- Create: `src/lib/auth/fediverse-callback.ts`
- Create: `src/lib/auth/fediverse-callback.test.ts`
- Create: `src/lib/auth/app-origin.ts`
- Create: `src/lib/auth/app-origin.test.ts`

**Interfaces:**
- Produces: `accountsMatch`, `authorizeUrl`, `fediverseRequest`, `loadOrRegisterApp`, `exchangeAuthorizationCode`, `fetchVerifiedAccount`
- Produces: `fediverseEmail(acct: string): string`, `publicEmailForAuthUser`, `httpsAvatar`, `establishFediverseSession`
- Produces: `parseFediState`, `fediverseCallbackPlan`
- Produces: `resolveAppOrigin(envUrl: string | undefined, requestOrigin: string): string`
- Consumes: `safeRedirectPath`

- [ ] `accountsMatch` requires username plus the profile URL host. A local `acct` without a domain is not host proof.
- [ ] `fediverseEmail("ada@mastodon.social")` is stable and ends with `@users.needle.invalid`.
- [ ] `establishFediverseSession` mints without creating on the second call. `createAuthUser` metadata has no email field. A duplicate create looks up again and still mints once.
- [ ] Callback plan: `access_denied` and a missing code return `fedi_canceled` and `mint: false`. A mismatched nonce returns `fedi_expired` and `mint: false`. A mismatched account returns `fedi_mismatch` and `mint: false`. A match returns `mint: true` and the safe path.
- [ ] Registration reuses a stored app and does not call the network again.
- [ ] Implement against injected fetch and re-run the new tests.

### Task 4: Schema

**Files:**
- Create: `supabase/migrations/008_fediverse_auth.sql`

- [ ] Add nullable unique `users.fediverse_acct`.
- [ ] Add `fediverse_oauth_apps` with RLS enabled and no policies.
- [ ] Replace `handle_new_user` so it trims `display_name`, `full_name`, then `name`, copies `avatar_url` or `picture`, copies `fediverse_acct`, stores null public email for `@users.needle.invalid`, and still inserts `user_stats`.

### Task 5: Continue screen and Supabase callback

**Files:**
- Create: `src/components/auth/ContinueForm.tsx`
- Modify: `src/app/auth/login/page.tsx`
- Modify: `src/app/auth/signup/page.tsx`
- Delete: `src/app/auth/login/LoginForm.tsx`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `src/app/api/profile/route.ts`

**Interfaces:**
- Consumes: `oauthRedirectTo`, `AUTH_ERROR_MESSAGES`, `authErrorMessage`, `emailSendError`, `callbackErrorCode`, `safeRedirectPath`, `publicEmailForAuthUser`, `parseFediverseHandle`

- [ ] Login and signup render `ContinueForm` with their own heading, lede, and alternate link.
- [ ] Google and Apple call `signInWithOAuth` after setting `needle_auth_provider`. Email calls `signInWithOtp` with `shouldCreateUser: true` and clears that cookie.
- [ ] `?email=` prefills email. `?handle=` opens the Fediverse field. `?redirect=` is passed through `oauthRedirectTo`.
- [ ] `/auth/callback` exchanges the code, redirects only through `safeRedirectPath`, and maps failures with `callbackErrorCode`.
- [ ] Profile fallback insert uses `publicEmailForAuthUser`.

### Task 6: Fediverse routes and README

**Files:**
- Create: `src/app/api/auth/fediverse/start/route.ts`
- Create: `src/app/auth/fediverse/callback/route.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: broker, session, callback plan, `resolveAppOrigin`, service client, cookie client

- [ ] `POST /api/auth/fediverse/start` parses, checks the host, loads or registers the app, sets `needle_fedi_state`, and returns `{ url }`. Failures return `{ error }` using `handle`, `fedi_refused`, or `fedi_unsupported`.
- [ ] `GET /auth/fediverse/callback` follows `fediverseCallbackPlan`. It mints only when the plan says `mint: true`. It clears the state cookie on every terminal redirect.
- [ ] README documents Google, Apple, email magic links, the Supabase redirect allow list, and that manual linking stays off.

- [ ] Run `npm test`.
- [ ] Open `/auth/login` and `/auth/signup` and confirm both screens show the four methods and no password field.
