import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bell,
  Car,
  Check,
  CheckCheck,
  CreditCard,
  Mail,
  Moon,
  Palette,
  Phone,
  Plus,
  Star,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  useCreateReview,
  useDeleteVehicle,
  useFacilities,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyReviews,
  useNotifications,
  useUpdateProfile,
  useUpdateVehicle,
  useCreateVehicle,
  useVehicles,
} from '@/lib/api/hooks';
import { USE_FIXTURES } from '@/lib/api';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { formatRelative } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { LANGUAGES, useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import type { Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/controls';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Avatar, PageHeader, RatingStars } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { EmptyState, PageSkeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

const emptyVehicle = { plate: '', make: '', model: '', color: '', year: '2020' };
const PLATE_PATTERN = /^\d{2}\s?[A-Z]\s?\d{3}\s?[A-Z]{2}$/;

export function VehiclesPage() {
  const { t } = useI18n();
  const vehicles = useVehicles();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyVehicle);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  usePageTitle(t('nav.vehicles'));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyVehicle);
    setError('');
    setOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
    setForm({
      plate: vehicle.plate,
      make: vehicle.make,
      model: vehicle.model,
      color: vehicle.color,
      year: String(vehicle.year),
    });
    setError('');
    setOpen(true);
  };

  const submit = () => {
    const plate = form.plate.toUpperCase().replace(/\s+/g, ' ').trim();
    if (!PLATE_PATTERN.test(plate)) {
      setError(t('errors.plate'));
      return;
    }
    const year = Number(form.year);
    if (!form.make.trim() || !form.model.trim() || !form.color.trim()) {
      setError(t('errors.required'));
      return;
    }
    if (!Number.isFinite(year) || year < 1980 || year > new Date().getFullYear() + 1) {
      setError(t('errors.min', { min: 1980 }));
      return;
    }
    const payload = {
      plate,
      make: form.make.trim(),
      model: form.model.trim(),
      color: form.color.trim(),
      year,
    };
    const onSuccess = () => {
      toast.success(editing ? t('user.saved') : t('user.profileUpdated'));
      setOpen(false);
    };
    const onError = (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : t('common.somethingWrong'));
    };
    if (editing) {
      updateVehicle.mutate({ id: editing.id, patch: payload }, { onSuccess, onError });
    } else {
      createVehicle.mutate(payload, { onSuccess, onError });
    }
  };

  const makeDefault = (vehicle: Vehicle) => {
    updateVehicle.mutate(
      { id: vehicle.id, patch: { isDefault: true } },
      {
        onSuccess: () => toast.success(t('user.saved')),
        onError: () => toast.error(t('common.somethingWrong')),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteVehicle.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(t('user.saved'));
        setDeleteTarget(null);
      },
      onError: (mutationError) => {
        toast.error(t('common.somethingWrong'), mutationError instanceof ApiError ? mutationError.message : undefined);
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('nav.vehicles')}
        description={t('user.overviewSubtitle')}
        actions={
          <Button leftIcon={<Plus />} onClick={openCreate}>
            {t('user.addVehicle')}
          </Button>
        }
      />

      {vehicles.isLoading ? (
        <PageSkeleton />
      ) : (vehicles.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Car />}
          title={t('user.noVehiclesTitle')}
          description={t('user.noVehiclesText')}
          action={
            <Button leftIcon={<Plus />} onClick={openCreate}>
              {t('user.addVehicle')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(vehicles.data ?? []).map((vehicle) => (
            <article key={vehicle.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-navy-50 text-navy-700 dark:bg-navy-500/15 dark:text-navy-200">
                  <Car className="size-5" />
                </span>
                {vehicle.isDefault ? (
                  <Badge tone="gold" size="sm">{t('user.defaultVehicle')}</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeDefault(vehicle)}
                    className="text-[11px] font-medium text-navy-600 hover:underline dark:text-navy-300"
                  >
                    {t('user.makeDefault')}
                  </button>
                )}
              </div>
              <p className="mt-4 font-mono text-lg font-bold tracking-wide text-foreground">{vehicle.plate}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {vehicle.make} {vehicle.model} · {vehicle.year}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{vehicle.color}</p>
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(vehicle)}>
                  {t('common.edit')}
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  leftIcon={<Trash2 />}
                  onClick={() => setDeleteTarget(vehicle)}
                  aria-label={t('common.delete')}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? t('user.editVehicle') : t('user.addVehicle')}
        description={t('booking.vehiclePlate')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={createVehicle.isPending || updateVehicle.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('booking.vehiclePlate')} htmlFor="vehicle-plate" required className="sm:col-span-2">
            <Input
              id="vehicle-plate"
              value={form.plate}
              placeholder="01 A 123 AB"
              className="font-mono uppercase"
              onChange={(event) => setForm({ ...form, plate: event.target.value })}
            />
          </Field>
          <Field label={t('booking.vehicleMake')} htmlFor="vehicle-make" required>
            <Input
              id="vehicle-make"
              value={form.make}
              placeholder="Chevrolet"
              onChange={(event) => setForm({ ...form, make: event.target.value })}
            />
          </Field>
          <Field label={t('booking.vehicleModel')} htmlFor="vehicle-model" required>
            <Input
              id="vehicle-model"
              value={form.model}
              placeholder="Cobalt"
              onChange={(event) => setForm({ ...form, model: event.target.value })}
            />
          </Field>
          <Field label={t('booking.vehicleColor')} htmlFor="vehicle-color" required>
            <Input
              id="vehicle-color"
              value={form.color}
              placeholder="Oq"
              onChange={(event) => setForm({ ...form, color: event.target.value })}
            />
          </Field>
          <Field label={t('booking.vehicleYear')} htmlFor="vehicle-year" required>
            <Input
              id="vehicle-year"
              type="number"
              value={form.year}
              onChange={(event) => setForm({ ...form, year: event.target.value })}
            />
          </Field>
          {error && (
            <p className="text-xs font-medium text-destructive sm:col-span-2" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t('common.delete')}
        description={t('user.deleteVehicleConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        loading={deleteVehicle.isPending}
        tone="danger"
      />
    </div>
  );
}

export function ReviewsPage() {
  const { t, tx, language } = useI18n();
  const { user } = useAuth();
  const reviews = useMyReviews();
  const facilities = useFacilities();
  const createReview = useCreateReview();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [facilityId, setFacilityId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  usePageTitle(t('nav.reviews'));

  const facilityById = new Map((facilities.data ?? []).map((facility) => [facility.id, facility]));

  const submit = () => {
    if (!facilityId) {
      setError(t('errors.required'));
      return;
    }
    if (comment.trim().length < 5) {
      setError(t('errors.min', { min: 5 }));
      return;
    }
    createReview.mutate(
      {
        facilityId,
        userId: user?.id ?? '',
        userName: user?.fullName ?? '',
        rating,
        comment: comment.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t('user.reviewThanks'));
          setOpen(false);
          setComment('');
          setRating(5);
        },
        onError: (mutationError) => {
          setError(mutationError instanceof ApiError ? mutationError.message : t('common.somethingWrong'));
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('user.myReviews')}
        description={t('user.overviewSubtitle')}
        actions={
          <Button leftIcon={<Star />} onClick={() => setOpen(true)}>
            {t('user.rateFacility')}
          </Button>
        }
      />

      {reviews.isLoading ? (
        <PageSkeleton />
      ) : (reviews.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Star />}
          title={t('user.myReviews')}
          description={t('facility.noReviews')}
          action={
            <Button leftIcon={<Star />} onClick={() => setOpen(true)}>
              {t('user.rateFacility')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(reviews.data ?? []).map((review) => {
            const facility = facilityById.get(review.facilityId);
            return (
              <article key={review.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {facility ? (
                      <Link
                        to={`/facilities/${facility.slug}`}
                        className="truncate text-[13px] font-semibold text-foreground hover:underline"
                      >
                        {tx(facility.name)}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-semibold text-foreground">{review.facilityId}</span>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelative(review.createdAt, language)}
                    </p>
                  </div>
                  <RatingStars value={review.rating} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('user.rateFacility')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={createReview.isPending}>
              {t('user.submitReview')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('booking.facility')} htmlFor="review-facility" required>
            <Select
              id="review-facility"
              value={facilityId}
              onChange={(event) => setFacilityId(event.target.value)}
            >
              <option value="">{t('common.search')}…</option>
              {(facilities.data ?? []).map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {tx(facility.name)}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="text-[13px] font-medium text-foreground">{t('facility.reviewRating')}</p>
            <div className="mt-1.5">
              <RatingStars value={rating} onChange={setRating} size={22} />
            </div>
          </div>
          <Field label={t('facility.reviewComment')} htmlFor="review-comment" required>
            <Textarea
              id="review-comment"
              value={comment}
              placeholder={t('user.reviewPlaceholder')}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
          {error && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

export function NotificationsPage() {
  const { t, tx, language } = useI18n();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  usePageTitle(t('nav.notifications'));

  const rows = (notifications.data ?? []).filter((item) => !unreadOnly || !item.read);
  const unread = (notifications.data ?? []).filter((item) => !item.read).length;

  const markAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success(t('notifications.allRead')),
      onError: () => toast.error(t('common.somethingWrong')),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.myArea')}
        title={t('notifications.title')}
        description={t('user.overviewSubtitle')}
        actions={
          <Button
            variant="outline"
            leftIcon={<CheckCheck />}
            onClick={markAll}
            disabled={unread === 0}
            loading={markAllRead.isPending}
          >
            {t('user.markAllRead')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? t('notifications.unread', { count: unread }) : t('notifications.allRead')}
        </p>
        <Button
          variant={unreadOnly ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setUnreadOnly((current) => !current)}
          aria-pressed={unreadOnly}
        >
          {t('notifications.unread', { count: unread })}
        </Button>
      </div>

      {notifications.isLoading ? (
        <PageSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Bell />} title={t('user.notificationsEmpty')} description={t('notifications.empty')} />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {rows.map((notification) => {
            const content = (
              <>
                <span
                  className={cn(
                    'mt-1 size-2 shrink-0 rounded-full',
                    notification.read ? 'bg-border' : 'bg-accent',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground">{tx(notification.title)}</p>
                    <Badge tone="outline" size="sm">{notification.kind}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tx(notification.body)}</p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                    {formatRelative(notification.createdAt, language)}
                  </p>
                </div>
                {!notification.read && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      markRead.mutate(notification.id);
                    }}
                    className="shrink-0 self-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={t('notifications.markRead')}
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </>
            );
            return (
              <li key={notification.id} className="border-b border-border last:border-0">
                {notification.href ? (
                  <Link
                    to={notification.href}
                    className={cn(
                      'flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/40',
                      !notification.read && 'bg-accent/[0.035]',
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className={cn('flex items-start gap-3 px-5 py-4', !notification.read && 'bg-accent/[0.035]')}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type ProfileValues = { fullName: string; email: string; phone: string };

export function ProfilePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const toast = useToast();
  usePageTitle(t('user.profileTitle'));

  const schema = z.object({
    fullName: z.string().min(2, t('errors.min', { min: 2 })),
    email: z.string().min(1, t('errors.required')).email(t('errors.email')),
    phone: z.string().min(7, t('errors.required')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    values: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync(values);
      toast.success(t('user.profileUpdated'));
    } catch (error) {
      toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined);
    }
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('nav.myArea')} title={t('user.profileTitle')} description={t('user.profileSubtitle')} />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <Avatar name={user.fullName} size="lg" className="mx-auto size-16 text-lg" />
          <h2 className="mt-3 font-display text-base font-semibold text-foreground">{user.fullName}</h2>
          <p className="text-xs text-muted-foreground">{user.email}</p>
          <div className="mt-3 flex justify-center">
            <Badge tone="gold">{t('auth.roleUser')}</Badge>
          </div>
          <dl className="mt-5 space-y-2 border-t border-border pt-4 text-left text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('auth.phone')}</dt>
              <dd className="font-medium text-foreground">{user.phone}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t('admin.date')}</dt>
              <dd className="font-medium text-foreground">{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('auth.fullName')} htmlFor="profile-name" required error={errors.fullName?.message}>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="profile-name" className="pl-9" aria-invalid={Boolean(errors.fullName)} {...register('fullName')} />
              </div>
            </Field>
            <Field label={t('auth.phone')} htmlFor="profile-phone" required error={errors.phone?.message}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="profile-phone" className="pl-9" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
              </div>
            </Field>
            <Field label={t('auth.email')} htmlFor="profile-email" required error={errors.email?.message} className="sm:col-span-2">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  className="pl-9"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </div>
            </Field>
          </div>
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <Button type="submit" loading={isSubmitting || updateProfile.isPending}>
              {t('user.saveChanges')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DevicePrefs {
  email: boolean;
  push: boolean;
  sms: boolean;
}

const PREFS_KEY = 'parkovka.notification-prefs';

function readPrefs(): DevicePrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DevicePrefs>;
      return { email: parsed.email ?? true, push: parsed.push ?? true, sms: parsed.sms ?? false };
    }
  } catch {
    // Preferences are optional; fall back to defaults.
  }
  return { email: true, push: true, sms: false };
}

export function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [prefs, setPrefs] = useState<DevicePrefs>(readPrefs);
  usePageTitle(t('nav.settings'));

  useEffect(() => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const updatePref = (key: keyof DevicePrefs, value: boolean) => {
    setPrefs((current) => ({ ...current, [key]: value }));
    toast.success(t('user.saved'));
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('nav.myArea')} title={t('nav.settings')} description={t('user.settingsSubtitle')} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <Palette className="size-4 text-accent" /> {t('user.appearance')}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                theme === 'light' ? 'border-gold-400 ring-1 ring-gold-400' : 'border-border hover:bg-muted/50',
              )}
            >
              <Sun className="size-5 text-amber-500" />
              <span className="mt-2 block text-[13px] font-semibold text-foreground">{t('user.themeLight')}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Stripe · Linear</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                theme === 'dark' ? 'border-gold-400 ring-1 ring-gold-400' : 'border-border hover:bg-muted/50',
              )}
            >
              <Moon className="size-5 text-navy-500" />
              <span className="mt-2 block text-[13px] font-semibold text-foreground">{t('user.themeDark')}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Navy · Gold</span>
            </button>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-[13px] font-semibold text-foreground">{t('user.language')}</h3>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {LANGUAGES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLanguage(item.code)}
                  aria-pressed={language === item.code}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors',
                    language === item.code
                      ? 'border-navy-900 bg-navy-900 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-navy-950'
                      : 'border-border text-foreground hover:bg-muted',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <Bell className="size-4 text-accent" /> {t('nav.notifications')}
          </h2>
          <div className="mt-2 divide-y divide-border">
            <SwitchField
              id="pref-email"
              checked={prefs.email}
              onCheckedChange={(checked) => updatePref('email', checked)}
              label={t('user.emailNotifications')}
              description={user?.email ?? ''}
            />
            <SwitchField
              id="pref-push"
              checked={prefs.push}
              onCheckedChange={(checked) => updatePref('push', checked)}
              label={t('user.pushNotifications')}
              description={t('home.trustOnline')}
            />
            <SwitchField
              id="pref-sms"
              checked={prefs.sms}
              onCheckedChange={(checked) => updatePref('sms', checked)}
              label={t('user.smsNotifications')}
              description={t('auth.phone')}
            />
          </div>
          {USE_FIXTURES && (
            <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {t('common.demoDataNote')}
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          <CreditCard className="size-4 text-accent" /> {t('user.security')}
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div>
            <p className="text-[13px] font-medium text-foreground">{t('user.changePassword')}</p>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
              {t('auth.secureNote')}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="mailto:hello@parkovka.uz">{t('footer.contact')}</a>
          </Button>
        </div>
      </section>
    </div>
  );
}
