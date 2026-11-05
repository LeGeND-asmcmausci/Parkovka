# Frontend audit and backend-integration report

Date: 2026-11-05  
Scope: frontend only. No backend source, Prisma schema, migrations or API routes were changed.
The existing premium design and all completed frontend functionality were preserved.

## Executive summary

The frontend is functionally complete in fixture mode and is ready for contract-driven backend
integration. The audit covered every route, dashboard, form, destructive action, payment surface,
QR flow, language, viewport and state. All discovered frontend defects were fixed and verified.

Final verification:

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Pass |
| ESLint | `npm run lint` | 0 errors, 9 pre-existing fast-refresh warnings |
| Unit / integration | `npm test` | 23 / 23 pass |
| Production build | `npm run build` | Pass |
| End-to-end | `npm run test:e2e` | 46 / 46 pass (Chromium) |

E2E coverage is split into three suites:

- `e2e/smoke.spec.ts` — 10 tests: public site, role routing, every dashboard page, full booking flow.
- `e2e/flows.spec.ts` — 18 tests: search/map, tickets/QR, vehicles, profile, reviews, notifications,
  payments, language, booking payment step, admin CRUD, guard entry/exit/scan/incidents.
- `e2e/audit.spec.ts` — 18 tests: horizontal overflow at 390x844, 834x1112 and 1440x900 for public,
  user, admin and guard areas; UZ/RU/EN switching and persistence; empty/validation states; mobile drawer.

No real payment was executed or simulated as successful. Payment tests verify provider visibility,
terms gating and receipt generation only.

## Completed audit tasks

1. Inspected the entire frontend project and identified features that only work because of fixtures
   or that have no backend surface.
2. Checked all pages, components, buttons, forms and navigation in every role.
3. Implemented or repaired frontend behavior for buttons that previously gave no feedback.
4. Audited the Admin, Guard and User dashboards (including all secondary pages).
5. Verified parking map zoom/reset, space selection, availability labels and booking hand-off.
6. Verified the reservation flow and WALK_IN guard entry/exit workflows end to end.
7. Verified QR ticket list/detail rendering, token display, download and guard validation UI.
8. Verified Payme, Click, Uzcard, Humo and cash options; no payment completion is faked.
9. Verified Uzbek, Russian and English switching, including persistence and status badges.
10. Verified responsive layouts on mobile (390x844), tablet (834x1112) and desktop (1440x900).
11. Verified loading skeletons, empty states, error states and form validation.
12. Removed/fixed duplicated behavior and frontend defects found during the audit.
13. Re-audited the API service architecture for real-backend readiness.
14. Compared every real API call with `docs/FRONTEND_API_CONTRACT.md`; no endpoint was invented.
15. Produced this report with required endpoints and remaining integration tasks.

## Frontend defects found and fixed

| # | Area | Defect | Fix | File |
| --- | --- | --- | --- | --- |
| 1 | Status badges | Every badge rendered the raw enum (`SUSPENDED`, `PAID`, `ACTIVE`, ...) because lookups used unprefixed keys while dictionaries use `status.*`. This broke localization across all dashboards. | Added `statusKey()` and prefix `status.` for every status; fallback still renders the raw enum for unknown values. | `src/components/ui/status-badge.tsx` |
| 2 | User payments | Searching `Naqd` returned no results. The filter searched the enum `CASH` but the UI renders `Naqd`. Payme/Click happened to work. | Include the localized `METHOD_LABEL` value in the search fields. | `src/pages/user/UserParkingPages.tsx` |
| 3 | Mobile reservations | The five-option filter control forced the page to 438px on a 390px viewport. | Made `SegmentedControl` horizontally scrollable (`max-w-full overflow-x-auto`) with non-shrinking, non-wrapping segments. | `src/components/ui/misc.tsx` |
| 4 | Admin reports | "Hisobot yaratish" refreshed data silently with no user feedback. | Added the existing `admin.reportGenerated` success toast after the refetch resolves. | `src/pages/admin/AdminConfigPages.tsx` |
| 5 | Fixtures | The demo vehicle `01 A 123 AB` was simultaneously in an active session and on the upcoming reservation, so a valid reservation QR check-in failed with "Vehicle is already inside". | The demo active session now uses the user's other vehicle `01 B 456 CD`; the reservation keeps `01 A 123 AB`. | `src/lib/api/fixtures.ts` |

Test-only corrections made while building the suites (not product defects): textbox role instead of
`searchbox`, scoping ticket links to the `RSV-9081` card, using the actual retry label
"Qayta urinib ko‘ring", blurring a field before clicking save to avoid a Playwright layout-shift
race, disambiguating duplicate headings, and scoping the guard exit "Tekshirish" button to its form.

## Test failures encountered and resolution

The first `flows.spec.ts` run had 9 failures and the first `audit.spec.ts` run had 3. Every failure
was diagnosed rather than skipped:

| Failure | Root cause | Resolution |
| --- | --- | --- |
| Ticket detail URL was `/ticket/res_4` | The first ticket card was not the demo reservation | Scope the link to the `RSV-9081` card |
| Missing "Qayta urinish" | Actual retry label is "Qayta urinib ko‘ring" | Corrected expectation |
| Profile success toast missing | Blur revalidation shifted layout between mousedown and mouseup, so Playwright's synthetic click was lost | Explicitly blur before saving in the test |
| Notifications locator strict violation | Same count appears in a paragraph and a filter button | Use `.first()` |
| `Naqd` not found in payments | Product bug: search ignored localized method label | Fixed `searchFn` |
| Suspended user still showed raw `SUSPENDED` | Product bug: status badge key prefix | Fixed `StatusBadge` |
| Report toast missing | Product bug: no feedback was wired | Added success toast |
| Guard exit "Tekshirish" strict violation | Five buttons share the label | Scope to the exit form |
| QR reservation check-in did not complete | Fixture vehicle conflict | Fixed fixture data |
| Mobile public overflow test timed out | Auth layout's marketing `h1` is hidden below `lg` | Wait for `h1:visible` |
| Mobile user overflow (438px > 390px) | Product bug: segmented control | Made it scrollable |
| Tablet public timeout | Same hidden `h1` issue | Same fix |

Final result: 46 / 46 E2E tests pass. No known failing test remains.

## Features that are incomplete in real-backend mode

These screens are complete in fixture mode but cannot operate against the current backend contract.
The real adapter returns an explicit `NOT_SUPPORTED` error instead of inventing routes, and the UI
surfaces it as an error toast.

| Feature | UI location | Current real-mode behavior | Blocking gap |
| --- | --- | --- | --- |
| Vehicle CRUD | `/app/vehicles` | `NOT_SUPPORTED` | No vehicle endpoints |
| Reviews | facility page, `/app/reviews` | `NOT_SUPPORTED` | No review endpoints |
| Notifications | `/app/notifications`, header menu | `NOT_SUPPORTED` | No notification endpoints |
| Admin facility/floor/zone/space management | `/admin/facilities`, `/admin/map` | `NOT_SUPPORTED` | No admin parking CRUD |
| Admin user create/update/suspend | `/admin/users`, `/admin/guards` | Create/update rejected; list works via `GET /users` | No create/update user endpoints |
| Admin reservation/session/payment listings | `/admin/reservations`, `/admin/sessions`, `/admin/payments` | User-scoped or rejected | No admin global listing endpoints |
| Admin statistics and reports | `/admin`, `/admin/reports` | `NOT_SUPPORTED` | No statistics/report endpoints |
| Cameras | `/admin/cameras` | `NOT_SUPPORTED` | No camera endpoints |
| Incidents | `/admin` incident views, `/guard/incidents` | `NOT_SUPPORTED` | No incident endpoints |
| Pricing rules | `/admin/pricing` | `NOT_SUPPORTED` | No pricing endpoints |
| Audit logs | `/admin/audit-logs` | `NOT_SUPPORTED` | No audit endpoint |
| System settings | `/admin/settings` | `NOT_SUPPORTED` | No settings endpoints |
| Guard shift summary | `/guard` | `NOT_SUPPORTED` | `GET /guard/sessions` is insufficient |
| Reserved / QR check-in | `/guard/scan` | `NOT_SUPPORTED` | `POST /guard/entry` rejects reservation/space data |
| Reservation QR lookup for guards | `/guard/scan` | Searches active sessions only | `verify-qr` returns validity, not reservation details |
| Booking payment | `/booking/:facilityId` step 5 | Reservation is created; no provider payment is initiated | Frontend wiring to `POST /payments` + `providerUrl` handling |
| Uzcard/Humo payment | booking and guard exit | Rejected in real mode | Backend accepts only CLICK, PAYME, CASH |
| Profile email change | `/app/profile` | Silently not sent | `PATCH /users/profile` does not accept `email` |
| Live updates | availability, sessions, notifications | Not implemented | Socket.IO events are documented but not consumed |

## Missing backend endpoints

The following resources are required by existing UI. Names are proposals only and must be confirmed
by the backend owner; the frontend will not invent them.

| Area | Required endpoint(s) | Consumer |
| --- | --- | --- |
| Vehicles | `GET/POST /api/vehicles`, `PATCH/DELETE /api/vehicles/:id` | User vehicles page, booking vehicle picker |
| Reviews | `GET /api/parking/:id/reviews`, `GET /api/users/me/reviews`, `POST /api/reviews` | Facility page, user reviews |
| Notifications | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all` | Header menu, user/admin notifications |
| Admin facilities | `POST/PATCH/DELETE /api/parking/:id`, floor/zone/space CRUD, `PATCH /api/spaces/:id/status` | Admin facilities and interactive map |
| Admin users | `POST /api/users`, `PATCH /api/users/:id`, guard facility assignment | Admin users/guards |
| Admin listings | Global `GET /api/admin/reservations`, `/admin/sessions`, `/admin/payments` (or role-aware filters) | Admin operations pages |
| Statistics | `GET /api/admin/stats?facilityId=&days=` returning revenue, bookings, occupancy, payment distribution, facility performance | Admin overview and reports |
| Cameras | `GET /api/cameras?facilityId=`, `PATCH /api/cameras/:id/toggle` | Admin cameras |
| Incidents | `GET/POST /api/incidents`, `POST /api/incidents/:id/resolve` | Guard incidents, admin views |
| Pricing rules | `GET /api/pricing-rules`, `PATCH /api/pricing-rules/:id` | Admin pricing |
| Audit logs | `GET /api/audit-logs` | Admin audit |
| System settings | `GET/PATCH /api/settings` | Admin settings |
| Guard summary | `GET /api/guard/summary` (today entries/exits/revenue/incidents) | Guard overview |
| Reservation QR | Extend `POST /api/guard/verify-qr` to return the reservation (id, reference, space, times, payment status), or add `GET /api/reservations/by-token/:token` | Guard scan |
| Reserved check-in | Extend `POST /api/guard/entry` to accept `reservationId`/`qrToken` and consume the reservation atomically | Guard scan/entry |
| Email update | Allow `email` in `PATCH /api/users/profile` or add a verified email-change endpoint | User profile |
| Payment methods | Extend `POST /api/payments` enum to UZCARD/HUMO, or the UI hides them in real mode | Booking, guard exit |

Already available and used correctly: auth (`/auth/login`, `/auth/register`, `/auth/refresh`,
`/auth/me`), profile (`PATCH /users/profile`), parking list/detail, reservations CRUD, guard
entry/exit/sessions, payments listing/initiation and admin user listing.

## Exact remaining integration tasks

1. Backend owner confirms or extends the contract for the resources above and publishes the final
   field shapes. Do not code against unconfirmed routes.
2. Add mapping functions in `src/lib/api/real.ts` alongside the existing `map*` helpers as each
   endpoint becomes available; keep `NOT_SUPPORTED` for unconfirmed areas.
3. Reserved/QR check-in:
   - switch `api.sessions.lookup` to the reservation-by-token endpoint;
   - pass `reservationId`/`qrToken` to `POST /guard/entry`;
   - let the backend consume the QR and mark the reservation `ACTIVE` transactionally.
4. Booking payment:
   - after `POST /reservations`, call `POST /payments` with `reservationId`, `amount`,
     `paymentMethod`;
   - redirect to `providerUrl` when present;
   - on return, poll reservation/payment status; never mark the booking paid client-side.
5. Decide Uzcard/Humo: either extend the backend enum or hide these options when
   `USE_FIXTURES === false`.
6. Confirm money units: the contract describes `priceCents` while values are documented as UZS.
   Normalize in `mapPayment`/`mapReservation` before enabling real payments.
7. Vehicle/review/notification clients: replace `notSupported` branches in `src/lib/api/index.ts`
   and verify the corresponding pages against a real backend.
8. Admin surfaces: implement facilities, users, stats, cameras, incidents, pricing, audit and
   settings adapters. Stats must not be derived from fixture data.
9. Guard summary: implement from the dedicated endpoint; do not approximate from session lists.
10. Profile email: re-enable the email field in the real adapter after the backend accepts it.
11. Freebuff must finish the pending backend tests and TypeScript fixes, then expose a stable base
    URL. Run the app with `VITE_API_URL=http://localhost:3001/api`.
12. Add a contract-level E2E suite that runs against the real backend (login, search, reserve,
    guard walk-in entry/exit, QR validation). Keep the current fixture suites for CI.
13. Optional: add a Socket.IO client for availability, session and notification updates, or use
    polling until it exists.
14. Verify fixture-only UI (demo badges, factory reset) remains hidden or disabled when
    `USE_FIXTURES` is false.

## Fixtures, security and data integrity

- Fixture mode is deterministic and localStorage-backed; it is selected when `VITE_API_URL` is
  absent or `VITE_USE_FIXTURES=true`.
- QR tokens shown in fixture mode (`PVK-XXXXXXXX`) are labeled demo values. In real mode tokens come
  from the backend reservation response; the frontend never generates production security tokens.
- No real payment provider was contacted and no payment success was simulated during the audit.
- Destructive actions (cancel reservation, suspend user, delete facility, factory reset) require an
  explicit confirmation dialog.
- Bearer tokens are persisted in `localStorage` because the contract uses bearer auth. For
  production, prefer an httpOnly refresh cookie and keep the access token in memory.
- Demo statistics, revenue and occupancy are fixture data, not production metrics.

## Files changed during the audit

Frontend fixes:

- `src/components/ui/status-badge.tsx`
- `src/components/ui/misc.tsx`
- `src/pages/user/UserParkingPages.tsx`
- `src/pages/admin/AdminConfigPages.tsx`
- `src/lib/api/fixtures.ts`

Tests and documentation:

- `e2e/flows.spec.ts` (new)
- `e2e/audit.spec.ts` (new)
- `docs/FRONTEND_AUDIT_REPORT.md` (this file)
- `docs/FRONTEND_BUILD_REPORT.md` (updated test counts)

No backend, Prisma, migration or route file was modified.
