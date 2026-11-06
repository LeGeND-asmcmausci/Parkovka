# Backend security changes (2026-11-06)

These notes describe the behaviour changes made before the frontend/backend
integration. Base URL and all existing response envelopes are unchanged.

## Authentication

- `POST /api/auth/register` always creates a `USER`. A `role` field in the body
  is ignored; it is not validated and never applied.
- New endpoint `POST /api/users` (ADMIN only) creates `ADMIN`/`GUARD`/`USER`
  accounts. Response: `201 { success, data: { user }, message }`.
- `POST /api/auth/refresh` accepts a refresh token in
  `Authorization: Bearer <refreshToken>` (or `refreshToken` in the body), loads
  email/role/status from the database and returns a rotated pair:
  `{ success, data: { accessToken, refreshToken } }`. The presented refresh
  token is revoked immediately, so replaying it returns `401`.
- Access tokens cannot be used at `/api/auth/refresh` and refresh tokens cannot
  be used on protected routes (`typ` claim is enforced).
- `POST /api/auth/logout` revokes the refresh token supplied in the body, or all
  active refresh tokens of the user when none is supplied. Access tokens stay
  valid for their remaining lifetime (<= 15 minutes).
- `authenticate` resolves the user from the database on every request, so role
  changes and suspensions take effect immediately.

## Payment callbacks

Callbacks now fail closed:

| Situation | Result |
|---|---|
| `CLICK_SECRET_KEY` set | Click `sign_string` (md5 of click_trans_id + service_id + secret + merchant_trans_id + amount + action + sign_time) is required |
| `PAYME_SECRET_KEY` set | `Authorization: Basic base64("Paycom:<key>")` is required |
| No provider key, `PAYMENT_TEST_MODE=true` and `PAYMENT_TEST_SECRET` set | `x-test-signature: sha256=<hmac-sha256(rawBody, PAYMENT_TEST_SECRET)>` is required |
| No provider key, test mode off | `503` — callback refused |
| `NODE_ENV=production` with test mode on | `503` — test mode never works in production |

Unsigned or wrongly signed callbacks never change a payment: it stays `PENDING`.
Payments are completed inside a `SELECT ... FOR UPDATE` transaction, so repeated
or concurrent callbacks are idempotent (`paidAt` is written once and the linked
reservation/session is updated once).

- Click `amount` is in UZS, Payme `amount` is in tiyin; both must match the
  stored `amountCents` or the callback is rejected (`-2` / `-31001`).
- Click `merchant_trans_id` and Payme `params.account.payment_id` carry our
  `paymentId`.

## Error responses

`HttpResponseError` now exists once (`src/utils/http-error.ts`,
re-exported from `src/middleware/error.ts`). Responses never contain `stack`,
whatever `NODE_ENV` is.

## Developer scripts

- `npm run dev` runs `ts-node src/index.ts` (the broken `--esm` flag is gone).
- `npm run db:seed` / `npx prisma db seed` seed local reference data.
- `npm test` runs the vitest suite.
