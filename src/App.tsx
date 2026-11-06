import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { RequireRole } from '@/components/layout/RequireRole';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { PageSkeleton } from '@/components/ui/states';

const HomePage = lazy(() => import('@/pages/public/HomePage').then((module) => ({ default: module.HomePage })));
const SearchPage = lazy(() => import('@/pages/public/SearchPage').then((module) => ({ default: module.SearchPage })));
const FacilityPage = lazy(() => import('@/pages/public/FacilityPage').then((module) => ({ default: module.FacilityPage })));
const ParkingMapPage = lazy(() => import('@/pages/public/ParkingMapPage').then((module) => ({ default: module.ParkingMapPage })));
const LegalPage = lazy(() => import('@/pages/public/LegalPage').then((module) => ({ default: module.LegalPage })));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const TicketPage = lazy(() => import('@/pages/public/TicketPage').then((module) => ({ default: module.TicketPage })));

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const BookingPage = lazy(() => import('@/pages/booking/BookingPage').then((module) => ({ default: module.BookingPage })));

const UserOverviewPage = lazy(() => import('@/pages/user/UserOverviewPage').then((module) => ({ default: module.UserOverviewPage })));
const ActiveParkingPage = lazy(() => import('@/pages/user/UserParkingPages').then((module) => ({ default: module.ActiveParkingPage })));
const ReservationsPage = lazy(() => import('@/pages/user/UserParkingPages').then((module) => ({ default: module.ReservationsPage })));
const TicketsPage = lazy(() => import('@/pages/user/UserParkingPages').then((module) => ({ default: module.TicketsPage })));
const PaymentsPage = lazy(() => import('@/pages/user/UserParkingPages').then((module) => ({ default: module.PaymentsPage })));
const VehiclesPage = lazy(() => import('@/pages/user/UserAccountPages').then((module) => ({ default: module.VehiclesPage })));
const ReviewsPage = lazy(() => import('@/pages/user/UserAccountPages').then((module) => ({ default: module.ReviewsPage })));
const NotificationsPage = lazy(() => import('@/pages/user/UserAccountPages').then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import('@/pages/user/UserAccountPages').then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/user/UserAccountPages').then((module) => ({ default: module.SettingsPage })));

const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage').then((module) => ({ default: module.AdminOverviewPage })));
const AdminFacilitiesPage = lazy(() => import('@/pages/admin/AdminFacilityPages').then((module) => ({ default: module.AdminFacilitiesPage })));
const AdminFloorsPage = lazy(() => import('@/pages/admin/AdminFacilityPages').then((module) => ({ default: module.AdminFloorsPage })));
const AdminZonesPage = lazy(() => import('@/pages/admin/AdminFacilityPages').then((module) => ({ default: module.AdminZonesPage })));
const AdminSpacesPage = lazy(() => import('@/pages/admin/AdminFacilityPages').then((module) => ({ default: module.AdminSpacesPage })));
const AdminMapPage = lazy(() => import('@/pages/admin/AdminFacilityPages').then((module) => ({ default: module.AdminMapPage })));
const AdminReservationsPage = lazy(() => import('@/pages/admin/AdminOperationsPages').then((module) => ({ default: module.AdminReservationsPage })));
const AdminSessionsPage = lazy(() => import('@/pages/admin/AdminOperationsPages').then((module) => ({ default: module.AdminSessionsPage })));
const AdminPaymentsPage = lazy(() => import('@/pages/admin/AdminOperationsPages').then((module) => ({ default: module.AdminPaymentsPage })));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminOperationsPages').then((module) => ({ default: module.AdminUsersPage })));
const AdminGuardsPage = lazy(() => import('@/pages/admin/AdminOperationsPages').then((module) => ({ default: module.AdminGuardsPage })));
const AdminPricingPage = lazy(() => import('@/pages/admin/AdminConfigPages').then((module) => ({ default: module.AdminPricingPage })));
const AdminCamerasPage = lazy(() => import('@/pages/admin/AdminConfigPages').then((module) => ({ default: module.AdminCamerasPage })));
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminConfigPages').then((module) => ({ default: module.AdminReportsPage })));
const AdminAuditLogsPage = lazy(() => import('@/pages/admin/AdminConfigPages').then((module) => ({ default: module.AdminAuditLogsPage })));
const AdminNotificationsPage = lazy(() => import('@/pages/admin/AdminConfigPages').then((module) => ({ default: module.AdminNotificationsPage })));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminConfigPages').then((module) => ({ default: module.AdminSettingsPage })));

const GuardOverviewPage = lazy(() => import('@/pages/guard/GuardCorePages').then((module) => ({ default: module.GuardOverviewPage })));
const GuardEntryPage = lazy(() => import('@/pages/guard/GuardCorePages').then((module) => ({ default: module.GuardEntryPage })));
const GuardExitPage = lazy(() => import('@/pages/guard/GuardCorePages').then((module) => ({ default: module.GuardExitPage })));
const GuardScanPage = lazy(() => import('@/pages/guard/GuardCorePages').then((module) => ({ default: module.GuardScanPage })));
const GuardSessionsPage = lazy(() => import('@/pages/guard/GuardOperationsPages').then((module) => ({ default: module.GuardSessionsPage })));
const GuardArrivalsPage = lazy(() => import('@/pages/guard/GuardOperationsPages').then((module) => ({ default: module.GuardArrivalsPage })));
const GuardDeparturesPage = lazy(() => import('@/pages/guard/GuardOperationsPages').then((module) => ({ default: module.GuardDeparturesPage })));
const GuardIncidentsPage = lazy(() => import('@/pages/guard/GuardOperationsPages').then((module) => ({ default: module.GuardIncidentsPage })));
const GuardActivityPage = lazy(() => import('@/pages/guard/GuardOperationsPages').then((module) => ({ default: module.GuardActivityPage })));

function Page({ children, container = false }: { children: ReactNode; container?: boolean }) {
  return (
    <Suspense
      fallback={
        container ? (
          <div className="page-container py-10">
            <PageSkeleton />
          </div>
        ) : (
          <PageSkeleton />
        )
      }
    >
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Page container><HomePage /></Page>} />
          <Route path="search" element={<Page container><SearchPage /></Page>} />
          <Route path="map" element={<Page><ParkingMapPage /></Page>} />
          <Route path="facilities/:slug" element={<Page container><FacilityPage /></Page>} />
          <Route path="legal/:kind" element={<Page container><LegalPage /></Page>} />
          <Route path="*" element={<Page container><NotFoundPage /></Page>} />
        </Route>

        <Route path="login" element={<Page container><LoginPage /></Page>} />
        <Route path="register" element={<Page container><RegisterPage /></Page>} />

        <Route element={<RequireAuth />}>
          <Route path="booking" element={<Page container><BookingPage /></Page>} />
          <Route path="booking/:facilityId" element={<Page container><BookingPage /></Page>} />
          <Route path="ticket/:id" element={<Page container><TicketPage /></Page>} />
        </Route>

        <Route element={<RequireRole role="USER" />}>
          <Route path="app" element={<DashboardLayout />}>
            <Route index element={<Page><UserOverviewPage /></Page>} />
            <Route path="active" element={<Page><ActiveParkingPage /></Page>} />
            <Route path="reservations" element={<Page><ReservationsPage /></Page>} />
            <Route path="tickets" element={<Page><TicketsPage /></Page>} />
            <Route path="vehicles" element={<Page><VehiclesPage /></Page>} />
            <Route path="payments" element={<Page><PaymentsPage /></Page>} />
            <Route path="reviews" element={<Page><ReviewsPage /></Page>} />
            <Route path="notifications" element={<Page><NotificationsPage /></Page>} />
            <Route path="profile" element={<Page><ProfilePage /></Page>} />
            <Route path="settings" element={<Page><SettingsPage /></Page>} />
            <Route path="*" element={<Page><NotFoundPage /></Page>} />
          </Route>
        </Route>

        <Route element={<RequireRole role="ADMIN" />}>
          <Route path="admin" element={<DashboardLayout />}>
            <Route index element={<Page><AdminOverviewPage /></Page>} />
            <Route path="facilities" element={<Page><AdminFacilitiesPage /></Page>} />
            <Route path="facilities/:facilityId/floors" element={<Page><AdminFloorsPage /></Page>} />
            <Route path="floors" element={<Page><AdminFloorsPage /></Page>} />
            <Route path="zones" element={<Page><AdminZonesPage /></Page>} />
            <Route path="spaces" element={<Page><AdminSpacesPage /></Page>} />
            <Route path="map" element={<Page><AdminMapPage /></Page>} />
            <Route path="reservations" element={<Page><AdminReservationsPage /></Page>} />
            <Route path="sessions" element={<Page><AdminSessionsPage /></Page>} />
            <Route path="payments" element={<Page><AdminPaymentsPage /></Page>} />
            <Route path="users" element={<Page><AdminUsersPage /></Page>} />
            <Route path="guards" element={<Page><AdminGuardsPage /></Page>} />
            <Route path="pricing" element={<Page><AdminPricingPage /></Page>} />
            <Route path="cameras" element={<Page><AdminCamerasPage /></Page>} />
            <Route path="reports" element={<Page><AdminReportsPage /></Page>} />
            <Route path="audit-logs" element={<Page><AdminAuditLogsPage /></Page>} />
            <Route path="notifications" element={<Page><AdminNotificationsPage /></Page>} />
            <Route path="settings" element={<Page><AdminSettingsPage /></Page>} />
            <Route path="*" element={<Page><NotFoundPage /></Page>} />
          </Route>
        </Route>

        <Route element={<RequireRole role="GUARD" />}>
          <Route path="guard" element={<DashboardLayout />}>
            <Route index element={<Page><GuardOverviewPage /></Page>} />
            <Route path="entry" element={<Page><GuardEntryPage /></Page>} />
            <Route path="exit" element={<Page><GuardExitPage /></Page>} />
            <Route path="scan" element={<Page><GuardScanPage /></Page>} />
            <Route path="sessions" element={<Page><GuardSessionsPage /></Page>} />
            <Route path="arrivals" element={<Page><GuardArrivalsPage /></Page>} />
            <Route path="departures" element={<Page><GuardDeparturesPage /></Page>} />
            <Route path="incidents" element={<Page><GuardIncidentsPage /></Page>} />
            <Route path="activity" element={<Page><GuardActivityPage /></Page>} />
            <Route path="*" element={<Page><NotFoundPage /></Page>} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
