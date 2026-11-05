# Frontend build report

## Status

Frontend phase complete in fixture mode. The application boots, routes by role, and all
dashboard pages render without runtime errors.

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Pass |
| Lint | `npm run lint` | Pass (0 errors, 9 pre-existing fast-refresh warnings) |
| Unit / integration | `npm run test` | 23 tests pass |
| Production build | `npm run build` | Pass |
| End-to-end | `npm run test:e2e` | 46 tests pass (Chromium) |

The post-implementation audit, its fixes and the backend integration gaps are recorded in
`docs/FRONTEND_AUDIT_REPORT.md`.

## Architecture

- React 19 + TypeScript strict, Vite 7, Tailwind CSS v4 design tokens.
- React Router 7 with `RequireAuth` / `RequireRole` guards and route-level code splitting.
- TanStack Query for server state, React Hook Form + Zod for forms.
- Typed i18n with Uzbek as the default dictionary; Russian and English must keep key parity.
- Fixture-first API: when `VITE_API_URL` is absent the app uses a deterministic,
  localStorage-backed mock that enforces reservation, check-in and checkout rules.
- Public site, user dashboard, admin dashboard and guard dashboard share one design system.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| User | `demo@parkovka.uz` | `parkovka` |
| Guard | `guard@parkovka.uz` | `parkovka` |
| Admin | `admin@parkovka.uz` | `parkovka` |

## Switching to the real backend

Create `.env.local` from `.env.example` and set `VITE_API_URL`, for example
`VITE_API_URL=http://localhost:3001/api`. When the variable is empty the fixture data
source is used. `VITE_USE_FIXTURES=true` forces fixtures even when a URL is configured.

The client already unwraps the documented `{ success, data }` response envelope and
refreshes expired sessions through `POST /auth/refresh`.

## Contract alignment with `docs/FRONTEND_API_CONTRACT.md`

The typed frontend client and the backend contract currently describe different surfaces.
This was not changed unilaterally. The fixture layer keeps the product usable while the
contract is reconciled.

### Naming differences

| Frontend client | Backend contract |
| --- | --- |
| `GET /facilities` | `GET /parking` |
| `GET /facilities/:idOrSlug` | `GET /parking/:id` |
| `GET /facilities/:id/floors` | Included inside `GET /parking/:id` |
| `PATCH /me` | `PATCH /users/profile` |
| `POST /sessions/check-in` | `POST /guard/entry` |
| `POST /sessions/:id/check-out` | `POST /guard/exit` |
| `GET /sessions/lookup` | `POST /guard/verify-qr` or `GET /guard/sessions` |
| `GET /guard/summary` | Not defined |
| `GET /admin/*` | Not defined |

### Field-shape differences

- Backend user uses `name`; frontend type uses `fullName`.
- Backend spaces use `spaceNumber`, `pricePerHour`, `pricePerDay`; frontend uses `code`,
  facility-level `hourlyRate` and `dailyCap`.
- Backend reservations use `startTime`, `endTime`, `priceCents`; frontend uses `startsAt`,
  `endsAt`, `totalAmount` in UZS.
- Backend returns `tokens.accessToken` and `tokens.refreshToken`; the frontend session type
  stores `accessToken` and `refreshToken` at the root. A small adapter is required even
  after the envelope is unwrapped.
- The contract expresses money as `priceCents` while describing values in UZS. The unit
  must be confirmed before mapping real payments.

### Backend endpoints still required by the UI

The following areas have no contract entry yet:

- Admin facilities, floors, zones and space-status management.
- Admin user and guard management.
- Reservations, sessions and payments listings for administrators.
- Dashboard statistics and report series.
- Cameras and camera toggling.
- Incidents (report and resolve).
- Pricing rules and updates.
- Audit logs.
- System settings.
- Notifications (list, mark one, mark all).
- Reviews (list and create).
- Vehicles (list, create, update, delete).
- Reservation lookup by ticket code.
- Health/status endpoint if the UI is to show backend connectivity.

Recommended next step: Freebuff confirms or extends the contract, then a thin mapping
module is added in `src/lib/api/` without changing UI components.

## Security notes

- No credentials are committed. The demo password is fixture data only.
- In real mode the QR token shown to guards comes from the backend reservation response;
  the frontend never invents production security tokens. Fixture mode generates local
  `PVK-XXXXXXXX` values for demonstration.
- The auth session is persisted in `localStorage` because the contract uses bearer tokens.
  For production, prefer an httpOnly refresh cookie and keep access tokens in memory.
- Destructive actions (cancel reservation, suspend user, delete facility, factory reset)
  require explicit confirmation.

## Known limitations

- QR camera scanning uses the browser `BarcodeDetector` API. Chromium-based browsers
  support it; other browsers get an honest unsupported message with manual code entry.
- Statistics and charts are fixture data until the reporting endpoints exist.
- The seeded active sessions and reservations are demo data, not production metrics.
- The E2E suite covers routing, role access, page rendering, the full reservation flow,
  admin and guard operations, language switching, empty states and mobile/tablet/desktop
  overflow across every dashboard page. Edge-case validation paths are still not
  exhaustively automated.

## Main files added in this phase

- `src/App.tsx` — full route tree with lazy-loaded pages.
- `src/pages/admin/AdminOperationsPages.tsx` — reservations, sessions, payments, users, guards.
- `src/pages/admin/AdminConfigPages.tsx` — pricing, cameras, reports, notifications, audit, settings.
- `src/pages/guard/GuardCorePages.tsx` — overview, entry, exit, QR scan.
- `src/pages/guard/GuardOperationsPages.tsx` — sessions, arrivals, departures, incidents, activity.
- `src/test/setup.ts`, `src/test/render.tsx` — test environment and providers.
- `public/images/facility-*.jpg` — original facility imagery for the six seeded facilities.
- Unit/integration tests under `src/**/*.test.tsx` and `src/lib/**/*.test.ts`.
- `e2e/smoke.spec.ts`, `playwright.config.ts` and `.env.example`.

## Fixes made during this phase

- Corrected admin facility table typing for availability fields.
- Fixed profile email updates so the password follows the new email key.
- Fixed checkout so a prepaid session cannot create a duplicate payment.
- Fixed a mixed-script facility fixture string.
- Fixed missing admin i18n keys and notification/guard translations.
- Fixed a rules-of-hooks violation in the camera admin page.
- Fixed login page handling of `INVALID_CREDENTIALS`.
- Scoped ESLint away from the backend and generated E2E artifacts.
