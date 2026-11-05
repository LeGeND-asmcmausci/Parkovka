import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { roleHome, useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { Logo } from '@/components/ui/logo';
import { Spinner } from '@/components/ui/states';

export function RequireRole({ role }: { role: Role }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background">
        <Logo />
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (user.role !== role) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <Outlet />;
}
