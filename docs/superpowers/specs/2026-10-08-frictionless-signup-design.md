# Frictionless Sign-Up — Design Spec

**Date:** 2026-10-08
**Status:** Approved (brainstorming; written-spec review pre-approved)
**Problem:** Needle only creates accounts with an email, a password, and a confirmation email. Joining should also work with Google, Apple, and a Fediverse handle, and every method should land the person in the app without a password or a second form.

---

## Goals

1. One continue screen for joining and returning, on both `/auth/login` and `/auth/signup`.
2. Continue with Google, Continue with Apple, Continue with the Fediverse, and an email magic link.
3. No password field and no display-name field on either screen.
4. Fediverse sign-in by handle. The person approves Needle on that server.
5. The same verified email is one Needle account across Google, Apple, and the magic link.
6. A Fediverse handle is its own account, keyed by the handle.
7. First-time visitors still pick a crowd color. Returning visitors who already have a color go to their destination.

## Non-Goals

- Misskey, Bluesky, and any login that does not speak Mastodon app registration (`POST /api/v1/apps`, authorize, token, `GET /api/v1/accounts/verify_credentials`).
- Connecting a Fediverse handle to an existing Google, Apple, or email account.
- A password field, a forgot-password link, or deleting password hashes already stored in Supabase.
- Changing the color onboarding step.
- WebFinger that sends the person to a different host than the one in the handle.

---

## Chosen Approach

Supabase Auth remains the session for every method. Google, Apple, and the email magic link use Supabase directly. The Fediverse is a short broker: prove the handle on the home server, then open a normal Supabase session.

Automatic linking of verified emails is Supabase’s built-in behavior. This version does not enable manual linking and does not call `linkIdentity`.

### Alternatives considered

| Approach | Why not chosen |
|----------|----------------|
| Replace Supabase Auth with a custom session layer for all four methods | Rooms, friends, and profile reads already assume a Supabase user and row security |
| Pre-register a few famous Fediverse servers as Supabase providers | Drops handle-based login on any Mastodon-compatible server |

---

## Continue Screen

`/auth/login` and `/auth/signup` both render the same form. Existing links keep working. The login heading stays “Welcome back”. The signup heading stays “Join the party”. The actions are identical.

From top to bottom:

1. **Continue with Google**
2. **Continue with Apple**
3. **Continue with the Fediverse.** Opens a handle field on this screen. It does not navigate to a new page.
4. **Email.** One address and the button “Email me a link”.

There is no password input, no display-name input, and no link that mentions a password.

Query params:

| Param | Behavior |
|-------|----------|
| `redirect` | Passed through Google, Apple, the magic link, and the Fediverse flow after `safeRedirectPath` |
| `email` | Prefills the email field. The landing-page capture already sends `/auth/signup?email=` |
| `handle` | Prefills the Fediverse field and leaves it open |
| `error` | Shows one message from the table below |

The landing-page email capture is unchanged.

### Display names

The continue screen does not ask for a name. The new-user trigger stores the first metadata value among `display_name`, `full_name`, and `name` that still has characters after trimming. An empty string does not count. If none qualify, it uses the local part of the auth email. Fediverse accounts set `display_name` in metadata before the user row is created: the Fediverse account’s `display_name` when it has non-whitespace text, otherwise the Fediverse username. Apple may omit the name after the first approval. The trigger runs only on insert, so the first stored name remains.

### After a successful session

The existing middleware is unchanged. A profile with no `avatar_color` goes to `/auth/onboarding` and keeps the destination in `redirect`. A profile that already has a color goes to the safe destination, or `/rooms`.

---

## Google, Apple, and Email

### Google and Apple

The browser calls `signInWithOAuth` with `provider: "google"` or `provider: "apple"` and `redirectTo` set to `/auth/callback` plus the safe `next` path. Before leaving Needle, the browser sets a non-secret cookie `needle_auth_provider` to `google` or `apple` (`Path=/`, `SameSite=Lax`, `Max-Age=600`). Starting an email link clears that cookie.

`/auth/callback` exchanges `code` for a session with the existing server client. On success it clears the provider cookie and redirects to the safe path. Buttons stay visible even when the Supabase provider is not configured yet. A failed or abandoned provider returns to the continue screen with that provider’s message.

### Email magic link

The browser calls `signInWithOtp` with `shouldCreateUser: true` and `emailRedirectTo` set to the same callback. The screen then replaces the form with: “Check your inbox. We sent a link to {email}.” plus a “Send again” button that calls the same API. That note is the same whether or not the address already has an account.

The link is the confirmation and the sign-in. The app does not call `signUp` or `signInWithPassword`. People who already have a password use the magic link, Google, Apple, or their Fediverse handle. Stored password hashes stay in Supabase and have no UI.

A Supabase error whose message contains “rate” (case-insensitive) shows “Wait a moment and try again.” Any other send failure shows “Enter a valid email.”

### Same email, one account

Google, Apple, and a magic link to the same verified address resolve to one Supabase user through automatic linking. An Apple private-relay address matches only that relay address. Fediverse sign-in never participates in this match.

### Callback redirect

`next` is passed through `safeRedirectPath` before it is joined to the request origin. The callback never redirects to another site.

`safeRedirectPath` returns `/rooms` unless the input is a string that:

- starts with a single `/`
- does not start with `//` or `/\`
- contains no `://`, backslash, newline, or NUL

---

## Fediverse

### Handle parser

`parseFediverseHandle` accepts:

- `name@server`
- `@name@server`
- `https://server/@name`
- `https://server/@name/`
- `https://server/users/name`
- `https://server/users/name/`

The username and host are trimmed and lowercased. The username must match `[a-z0-9_]{1,30}`. The host must be a DNS name with at least two labels, a letter TLD, and no port. Profile URLs must be `https`, with no userinfo, port, query, or hash. A path that contains a second `@` is rejected.

Success returns `{ username, host, acct }` where `acct` is `username@host`. Failure is an invalid handle. The host in the handle is the server Needle contacts. This version does not follow WebFinger to a different host.

### Host check

Before any request, `assertPublicHost` resolves the host and refuses it when any of these are true:

- the name is `localhost`, or ends with `.local`, `.localhost`, `.internal`, or `.invalid`
- any resolved address is loopback, private, link-local, CGNAT (`100.64.0.0/10`), multicast, unspecified, or IPv4 `0.0.0.0/8`
- DNS resolution fails

The user-facing message for a refused host is “That server can’t be used.”

### App registration

The first successful login for a host registers Needle:

`POST https://{host}/api/v1/apps`

```json
{
  "client_name": "Needle",
  "redirect_uris": "{origin}/auth/fediverse/callback",
  "scopes": "read:accounts",
  "website": "{origin}"
}
```

`origin` is `NEXT_PUBLIC_APP_URL` with no trailing slash when that variable is set, otherwise the origin of the incoming request. Registration and the later token exchange use that same redirect URI.

`client_id` and `client_secret` are stored in `fediverse_oauth_apps`, keyed by lowercase host. Later logins reuse that row and do not register again. The browser never sees the client secret.

### Start

`POST /api/auth/fediverse/start` with `{ handle, next }`:

1. Parse the handle. Invalid → `400` and “Enter your handle as name@server.”
2. Refuse a non-public host → `400` and “That server can’t be used.”
3. Load or register the app. Network failure, timeout, a redirect, or a non-Mastodon response → `400` and “That server doesn’t support this sign-in.”
4. Set httpOnly cookie `needle_fedi_state` (`Path=/auth/fediverse`, `SameSite=Lax`, `Secure` in production, `Max-Age=600`) containing a random nonce, the expected `acct`, the host, and the safe redirect.
5. Return the authorize URL. The browser navigates there.

Authorize URL:

`https://{host}/oauth/authorize?client_id={id}&redirect_uri={callback}&response_type=code&scope=read:accounts&state={nonce}`

### Callback

`GET /auth/fediverse/callback`:

| Condition | Result |
|-----------|--------|
| Provider sends `error=access_denied`, or no `code` | `/auth/login?error=fedi_canceled&handle={acct}` when the cookie still has the handle. Field stays open |
| Cookie missing, expired, or `state` ≠ nonce | `/auth/login?error=fedi_expired`. No session |
| Token or credential request fails, times out, or redirects | `/auth/login?error=fedi_unsupported&handle={acct}` |
| Approved account does not match | `/auth/login?error=fedi_mismatch`. No session |
| Match | Session cookie, clear the state cookie, redirect to the safe path |

Every outbound call uses HTTPS on port 443, a timeout of 8 seconds, and `redirect: "manual"`. A 3xx response is a failure. The host is checked again immediately before each call.

### Account match

`verify_credentials` must satisfy both:

- `username`, lowercased, equals the requested username
- the host of `url` equals the requested host

Mastodon’s local `acct` field omits the domain. Needle does not treat that field as proof of the host. A credential email, if the server sends one, is ignored.

### Session

The Supabase email for a Fediverse account is `fedi.` plus the lowercase hex SHA-256 of the UTF-8 normalized acct, then `@users.needle.invalid`. It is stable, it is not deliverable, and it is recomputed from the handle. The human handle is stored only as `users.fediverse_acct` and in auth metadata.

Find-or-create:

1. Look up `public.users.fediverse_acct`.
2. If missing, `auth.admin.createUser` with `email_confirm: true` and metadata `display_name`, `avatar_url` (https only, otherwise omit), and `fediverse_acct`.
3. If create fails because that synthetic email already exists, look up the account again and continue.
4. `auth.admin.generateLink({ type: "magiclink", email })` creates a token and does not send mail.
5. The cookie-bound server client calls `verifyOtp({ token_hash, type: "magiclink" })`.

A failed attempt does not create a profile. A second visit with the same handle returns the same account.

Avatar comes from the `avatar` field when it is an `https` URL.

### Profile row

`handle_new_user` copies `fediverse_acct` from metadata. When `NEW.email` ends with `@users.needle.invalid`, `public.users.email` is stored as null so friend search and the profile fallback cannot reveal the synthetic address. The auth user keeps the synthetic email so the session mint can find it.

The profile insert fallback in `src/app/api/profile/route.ts` uses the same email rule.

---

## Data

Migration `supabase/migrations/008_fediverse_auth.sql`:

```sql
ALTER TABLE public.users
  ADD COLUMN fediverse_acct TEXT UNIQUE;

CREATE TABLE public.fediverse_oauth_apps (
  host TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fediverse_oauth_apps ENABLE ROW LEVEL SECURITY;
```

No policies on `fediverse_oauth_apps`. The service role bypasses RLS. `anon` and `authenticated` cannot read or write it.

The trigger function is replaced so display name, avatar, fediverse handle, and the synthetic-email rule all apply. It still inserts `user_stats`.

---

## Errors

One sentence on the continue screen. No session unless the provider approved the account the person asked for.

| Code or case | Message |
|--------------|---------|
| `google` | Google sign-in didn’t complete. Try again. |
| `apple` | Apple sign-in didn’t complete. Try again. |
| `auth`, or a provider cookie with any other value | Sign-in didn’t complete. Try again. |
| Callback exchange failed and the provider cookie is absent | That link expired. Request a new one. |
| Invalid email, or a non-rate send error | Enter a valid email. |
| Send error message contains “rate” | Wait a moment and try again. |
| Invalid handle | Enter your handle as name@server. |
| Refused host | That server can’t be used. |
| `fedi_unsupported` | That server doesn’t support this sign-in. |
| `fedi_canceled` | Approval was canceled. |
| `fedi_expired` | That sign-in expired. Enter your handle again. |
| `fedi_mismatch` | That account doesn’t match the handle you entered. |

Canceled, expired, and unsupported returns include `handle` when Needle still knows it, and the field is open. Raw provider errors are not shown.

---

## Modules

| Module | Responsibility |
|--------|----------------|
| `src/components/auth/ContinueForm.tsx` | The shared form, magic link, Google, Apple, and Fediverse field |
| `src/lib/auth/safe-redirect.ts` | `safeRedirectPath` |
| `src/lib/auth/auth-errors.ts` | The message table |
| `src/lib/auth/fediverse-handle.ts` | `parseFediverseHandle` |
| `src/lib/auth/fediverse-host.ts` | `assertPublicHost` |
| `src/lib/auth/fediverse-broker.ts` | Register, authorize URL, token exchange, credential fetch, `accountsMatch` |
| `src/lib/auth/fediverse-session.ts` | Synthetic email, find-or-create, mint |
| `src/app/api/auth/fediverse/start/route.ts` | Start route |
| `src/app/auth/fediverse/callback/route.ts` | Callback route |
| `src/app/auth/callback/route.ts` | Existing code exchange, plus the redirect guard and error messages |
| `src/app/auth/login/page.tsx`, `src/app/auth/signup/page.tsx` | Render `ContinueForm` |
| `src/app/api/profile/route.ts` | Hide synthetic emails on the fallback insert |

`src/app/auth/login/LoginForm.tsx` is removed once the login page no longer imports it. Route handlers stay thin and call the modules above.

---

## Operator Setup

Document this in the README. The app cannot toggle it.

1. Supabase → Authentication → Sign In / Providers → Email stays enabled. “Allow new users to sign up” stays on. The app never calls the password APIs.
2. Enable the Google provider. The Google Cloud redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Enable the Apple provider (Services ID, Team ID, Key ID, private key, and Apple’s domain verification). Same Supabase callback URL.
4. Authentication → URL Configuration: site URL is the app origin. Redirect allow list includes `http://localhost:3000/auth/callback` and the production `/auth/callback`. The Fediverse callback is on Needle, not in this list.
5. Leave manual linking off. Automatic linking of a verified email is already how Supabase Auth works.

---

## Testing

Vitest, beside the modules, with injected DNS and fetch. No live Google, Apple, Mastodon, or Supabase calls.

- `safeRedirectPath`: `/rooms` and `/rooms/a?x=1` pass. `//evil.com`, `/\evil`, `https://evil.com`, missing, and empty become `/rooms`.
- `parseFediverseHandle`: each accepted form, case folding, and the rejected forms (http, extra `@`, bare IP, query string, empty).
- `assertPublicHost`: public addresses pass. Loopback, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, link-local, CGNAT, `localhost`, and `.local` fail. The lookup function is injected.
- `accountsMatch`: username plus profile-URL host. A local Mastodon `acct` without a domain still requires the URL host. A different host fails.
- Session mint: the synthetic email is stable and ends with `@users.needle.invalid`. The second call with the same handle does not create another user. A credential email of `someone@gmail.com` is not passed to create. Failed match is not this module’s job; the callback refuses before minting.
- Callback decision function: canceled, stale state, and mismatched account each return the matching error redirect and do not call mint.
- `auth-errors`: each code maps to the sentence in the table.

Google, Apple, and `signInWithOtp` are covered by the form calling those client methods with the safe redirect. Live provider setup stays in the README.

---

## Out of Scope Reminder

Misskey and other non-Mastodon logins, linking a Fediverse handle to an email account, password UI, and changes to the color step are not part of this version.
