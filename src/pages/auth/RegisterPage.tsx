import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { roleHome, useAuth } from '@/lib/auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { AuthLayout } from './AuthLayout';

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

export function RegisterPage() {
  const { t } = useI18n();
  const { register: registerUser, user, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  usePageTitle(t('auth.registerButton'));

  const schema = z
    .object({
      fullName: z.string().min(2, t('errors.min', { min: 2 })),
      email: z.string().min(1, t('errors.required')).email(t('errors.email')),
      phone: z.string().min(7, t('errors.required')),
      password: z.string().min(8, t('errors.passwordLength')),
      confirmPassword: z.string().min(1, t('errors.required')),
      terms: z.boolean(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      path: ['confirmPassword'],
      message: t('errors.passwordMatch'),
    })
    .refine((values) => values.terms, {
      path: ['terms'],
      message: t('errors.termsRequired'),
    });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
    mode: 'onBlur',
  });

  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from.startsWith('/') && !from.startsWith('//') ? from : null;
  const terms = watch('terms');

  if (status === 'authenticated' && user) {
    return <Navigate to={target ?? roleHome(user.role)} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      const created = await registerUser({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        password: values.password,
      });
      toast.success(t('auth.registerSuccess'), t('auth.welcomeBack', { name: created.fullName.split(' ')[0] }));
      navigate(target ?? roleHome(created.role), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION') {
        setFormError(error.message);
      } else {
        setFormError(t('errors.generic'));
      }
    }
  });

  return (
    <AuthLayout>
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-foreground">
          {t('auth.registerTitle')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('auth.registerSubtitle')}</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
          <Field label={t('auth.fullName')} htmlFor="register-name" required error={errors.fullName?.message}>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="register-name"
                autoComplete="name"
                placeholder="Dilshod Karimov"
                className="pl-9"
                aria-invalid={Boolean(errors.fullName)}
                {...register('fullName')}
              />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('auth.email')} htmlFor="register-email" required error={errors.email?.message}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  className="pl-9"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </div>
            </Field>

            <Field label={t('auth.phone')} htmlFor="register-phone" required error={errors.phone?.message}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="register-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder={t('auth.phonePlaceholder')}
                  className="pl-9"
                  aria-invalid={Boolean(errors.phone)}
                  {...register('phone')}
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('auth.password')} htmlFor="register-password" required error={errors.password?.message}>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="px-9"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t('auth.password')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Field
              label={t('auth.confirmPassword')}
              htmlFor="register-confirm"
              required
              error={errors.confirmPassword?.message}
            >
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="register-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pl-9"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...register('confirmPassword')}
                />
              </div>
            </Field>
          </div>

          <div>
            <CheckboxField
              id="register-terms"
              checked={terms}
              onCheckedChange={(checked) => setValue('terms', checked === true, { shouldValidate: true })}
              label={t('auth.agreeTerms')}
              description={
                <span className="flex flex-wrap items-center gap-1.5">
                  <Link to="/legal/terms" className="font-medium text-navy-700 hover:underline dark:text-navy-300">
                    {t('footer.terms')}
                  </Link>
                  <span aria-hidden>·</span>
                  <Link to="/legal/privacy" className="font-medium text-navy-700 hover:underline dark:text-navy-300">
                    {t('footer.privacy')}
                  </Link>
                </span>
              }
            />
            {errors.terms && (
              <p className="mt-1 text-xs font-medium text-destructive" role="alert">
                {errors.terms.message}
              </p>
            )}
          </div>

          {formError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive" role="alert">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} rightIcon={<ArrowRight />}>
            {t('auth.registerButton')}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" state={location.state} className="font-semibold text-navy-700 hover:underline dark:text-navy-300">
            {t('auth.loginButton')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
