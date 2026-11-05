import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { RequireRole } from '@/components/layout/RequireRole';
import { resetFixtures } from '@/lib/api/store';
import { renderWithProviders, seedSession } from '@/test/render';

function guardedRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<div>login-stub</div>} />
      <Route path="/app" element={<div>user-home-stub</div>} />
      <Route path="/guard" element={<div>guard-home-stub</div>} />
      <Route path="/admin" element={<div>admin-home-stub</div>} />
      <Route element={<RequireRole role="ADMIN" />}>
        <Route path="/admin/secret" element={<div>admin-secret-stub</div>} />
      </Route>
    </Routes>
  );
}

describe('RequireRole', () => {
  beforeEach(() => {
    resetFixtures();
  });

  it('redirects anonymous visitors to the login page', async () => {
    renderWithProviders(guardedRoutes(), { route: '/admin/secret' });

    expect(await screen.findByText('login-stub')).toBeInTheDocument();
    expect(screen.queryByText('admin-secret-stub')).not.toBeInTheDocument();
  });

  it('sends a signed-in user with the wrong role to their own dashboard', async () => {
    await seedSession('demo@parkovka.uz');
    renderWithProviders(guardedRoutes(), { route: '/admin/secret' });

    expect(await screen.findByText('user-home-stub')).toBeInTheDocument();
    expect(screen.queryByText('admin-secret-stub')).not.toBeInTheDocument();
  });

  it('renders the guarded route for the matching role', async () => {
    await seedSession('admin@parkovka.uz');
    renderWithProviders(guardedRoutes(), { route: '/admin/secret' });

    expect(await screen.findByText('admin-secret-stub')).toBeInTheDocument();
  });
});
