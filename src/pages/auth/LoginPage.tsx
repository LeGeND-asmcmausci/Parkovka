import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, ScanLine, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { roleHome, useAuth } from '@/lib/auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AuthLayout } from './AuthLayout';

type FormValues = { email: string; password: string };

const DEMO_ACCOUNTS: { roleKey: 'auth.roleUser' | 'auth.roleGuard' | 'auth.roleAdmin'; emailKey: 'auth.demoUser' | 'auth.demoGuard' | 'auth.demoAdmin'; icon: LucideIcon }[] = [
  { roleKey: 'auth.roleUser', emailKey: 'auth.demoUser', icon: UserRound },
  { roleKey: 'auth.roleGuard', emailKey: 'auth.demoGuard', icon: ScanLine },
  { roleKey: 'auth.roleAdmin', emailKey: 'auth.demoAdmin', icon: ShieldCheck },
];

export function LoginPage() {
  const { t } = useI18n();
  const { login, user, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  usePageTitle(t('nav.login'));

  const schema = z.object({
    email: z.string().min(1, t('errors.required')).email(t('errors.email')),
    password: z.string().min(8, t('errors.passwordLength')),
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from.startsWith('/') && !from.startsWith('//') ? from : null;

  if (status === 'authenticated' && user) {
    return <Navigate to={target ?? roleHome(user.role)} replace />;
  }

  const doLogin = async (email: string, password: string) => {
    setFormError('');
    try {
      const loggedIn = await login(email, password);
      toast.success(t('auth.loginSuccess'), t('auth.welcomeBack', { name: loggedIn.fullName.split(' ')[0] }));
      navigate(target ?? roleHome(loggedIn.role), { replace: true });
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_CREDENTIALS')
      ) {
        setFormError(t('auth.invalidCredentials'));
      } else {
        setFormError(t('errors.loginFailed'));
      }
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    await doLogin(values.email.trim(), values.password);
  });

  const demoLogin = async (email: string) => {
    setValue('email', email);
    setValue('password', 'parkovka');
    setDemoLoading(email);
    try {
      await doLogin(email, 'parkovka');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <AuthLayout>
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-foreground">
          {t('auth.loginTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('auth.loginSubtitle')}</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
          <Field label={t('auth.email')} htmlFor="login-email" required error={errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                className="pl-9"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </div>
          </Field>

          <Field label={t('auth.password')} htmlFor="login-password" required error={errors.password?.message}>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="px-9"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? t('auth.password') : t('auth.password')}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">{t('auth.passwordHint')}</span>
            <button
              type="button"
              onClick={() => toast.info(t('auth.forgot'), t('home.contactText'))}
              className="text-[12px] font-medium text-navy-600 hover:underline dark:text-navy-300"
            >
              {t('auth.forgot')}
            </button>
          </div>

          {formError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive" role="alert">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} rightIcon={<ArrowRight />}>
            {t('auth.loginButton')}
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('auth.demoTitle')}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('auth.demoHint')}</p>
          <div className="mt-3 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = account.icon;
              return (
                <button
                  key={account.emailKey}
                  type="button"
                  onClick={() => void demoLogin(t(account.emailKey))}
                  disabled={demoLoading !== null}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-gold-300 hover:bg-gold-50/40 disabled:opacity-60 dark:hover:border-gold-500/40 dark:hover:bg-gold-500/5"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-md bg-muted text-navy-700 dark:text-navy-300">
                      <Icon className="size-3.5" />
                    </span>
                    <span>
                      <span className="block text-[12px] font-semibold text-foreground">{t(account.roleKey)}</span>
                      <span className="block text-[10px] text-muted-foreground">{t(account.emailKey)}</span>
                    </span>
                  </span>
                  <span className="text-[10px] font-medium text-navy-600 dark:text-navy-300">
                    {demoLoading === t(account.emailKey) ? t('common.loading') : t('auth.loginButton')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link to="/register" state={location.state} className="font-semibold text-navy-700 hover:underline dark:text-navy-300">
            {t('auth.registerButton')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
