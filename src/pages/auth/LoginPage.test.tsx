import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { resetFixtures } from '@/lib/api/store';
import { translate } from '@/lib/i18n';
import { renderWithProviders } from '@/test/render';

function loginRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<div>user-home-stub</div>} />
    </Routes>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    resetFixtures();
  });

  it('shows a friendly error for invalid credentials', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(loginRoutes(), { route: '/login' });

    await user.type(container.querySelector('#login-email') as HTMLInputElement, 'demo@parkovka.uz');
    await user.type(container.querySelector('#login-password') as HTMLInputElement, 'wrong-password');
    await user.click(
      screen.getByRole('button', { name: translate('uz', 'auth.loginButton') }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      translate('uz', 'auth.invalidCredentials'),
    );
  });

  it('signs in through a demo account button', async () => {
    const user = userEvent.setup();
    renderWithProviders(loginRoutes(), { route: '/login' });

    const demoButton = await screen.findByRole('button', {
      name: new RegExp(translate('uz', 'auth.demoUser')),
    });
    await user.click(demoButton);

    await waitFor(() => expect(screen.getByText('user-home-stub')).toBeInTheDocument(), {
      timeout: 4000,
    });
    expect(JSON.parse(window.localStorage.getItem('parkovka.session.v1') ?? '{}')).toMatchObject({
      user: { email: translate('uz', 'auth.demoUser') },
    });
  });
});
