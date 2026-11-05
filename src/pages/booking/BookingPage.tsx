import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  Plus,
  ShieldCheck,
  Ticket,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreateReservation, useFacilities, useFacility, useFloors, useSpaceAvailability, useSpaces, useVehicles, useZones, useCreateVehicle } from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/errors';
import { formatAmount, formatFullDateTime, formatDuration } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import type { FacilityWithAvailability, PaymentMethod, ParkingSpace, Reservation } from '@/lib/types';
import { cn, hoursBetween, toLocalIso } from '@/lib/utils';
import { FacilityImage } from '@/components/facilities/FacilityImage';
import { ParkingMap } from '@/components/map/ParkingMap';
import { ZONE_TYPE_KEYS } from '@/components/facilities/facility-utils';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { DetailRow, Stepper } from '@/components/ui/misc';
import { Logo } from '@/components/ui/logo';
import { LanguageSwitcher, ThemeToggle } from '@/components/ui/preferences';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

const STEP_KEYS = [
  'booking.step1',
  'booking.step2',
  'booking.step3',
  'booking.step4',
  'booking.step5',
  'booking.step6',
  'booking.step7',
] as const;

const PAYMENT_METHODS: { value: PaymentMethod; labelKey: 'booking.payme' | 'booking.click' | 'booking.uzcard' | 'booking.humo' | 'booking.cashAtExit'; icon: typeof CreditCard }[] = [
  { value: 'PAYME', labelKey: 'booking.payme', icon: CreditCard },
  { value: 'CLICK', labelKey: 'booking.click', icon: Wallet },
  { value: 'UZCARD', labelKey: 'booking.uzcard', icon: CreditCard },
  { value: 'HUMO', labelKey: 'booking.humo', icon: CreditCard },
  { value: 'CASH', labelKey: 'booking.cashAtExit', icon: Banknote },
];

function nextHour(offset = 1) {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + offset);
  return toLocalIso(date);
}

export function BookingPage() {
  const { facilityId: routeSlug } = useParams();
  const [params] = useSearchParams();
  const { t, tx, language } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState(routeSlug ?? '');
  const [startsAt, setStartsAt] = useState(() => nextHour(1));
  const [endsAt, setEndsAt] = useState(() => nextHour(3));
  const [timeError, setTimeError] = useState('');
  const [floorId, setFloorId] = useState<string | undefined>(params.get('floorId') ?? undefined);
  const [zoneId, setZoneId] = useState<string | undefined>(params.get('zoneId') ?? undefined);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [vehicleId, setVehicleId] = useState<string>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PAYME');
  const [terms, setTerms] = useState(false);
  const [stepsError, setStepsError] = useState('');
  const [created, setCreated] = useState<Reservation | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ plate: '', make: '', model: '', color: '', year: '2020' });
  const [vehicleError, setVehicleError] = useState('');
  const selectionInitialized = useRef(false);

  const paramSpaceId = params.get('spaceId');
  const paramSpaceCode = params.get('spaceCode');

  const { data: facilities = [], isLoading: facilitiesLoading } = useFacilities();
  const { data: facility } = useFacility(slug || undefined);
  const { data: floors = [] } = useFloors(facility?.id);
  const { data: zones = [] } = useZones(floorId);
  const { data: spaces = [] } = useSpaces({ facilityId: facility?.id, floorId });
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const availability = useSpaceAvailability(selectedSpace?.id);
  const createReservation = useCreateReservation();
  const createVehicle = useCreateVehicle();

  usePageTitle(t('booking.title'));

  useEffect(() => {
    if (floors.length === 0) return;
    if (!floorId || !floors.some((floor) => floor.id === floorId)) {
      setFloorId(floors[0].id);
    }
  }, [floors, floorId]);

  useEffect(() => {
    if (zones.length === 0) return;
    if (!zoneId || !zones.some((zone) => zone.id === zoneId)) {
      setZoneId(zones[0].id);
    }
  }, [zones, zoneId]);

  useEffect(() => {
    if (selectionInitialized.current || spaces.length === 0) return;
    if (paramSpaceId) {
      const match = spaces.find((space) => space.id === paramSpaceId);
      if (match && match.status === 'AVAILABLE') setSelectedSpace(match);
    }
    selectionInitialized.current = true;
  }, [paramSpaceId, spaces]);

  useEffect(() => {
    if (vehicles.length === 0) return;
    if (!vehicleId) {
      setVehicleId((vehicles.find((vehicle) => vehicle.isDefault) ?? vehicles[0]).id);
    }
  }, [vehicleId, vehicles]);

  useEffect(() => {
    if (!routeSlug) return;
    setSlug(routeSlug);
    selectionInitialized.current = false;
    setSelectedSpace(null);
    setFloorId(undefined);
    setZoneId(undefined);
  }, [routeSlug]);

  const zone = zones.find((item) => item.id === zoneId);
  const hours = useMemo(() => {
    const value = hoursBetween(startsAt, endsAt);
    return Number.isFinite(value) ? value : 0;
  }, [startsAt, endsAt]);
  const billedHours = Math.max(1, Math.ceil(hours));
  const rate = (facility?.hourlyRate ?? 0) * (zone?.rateMultiplier ?? 1);
  const parkingAmount = Math.round(Math.min(facility?.dailyCap ?? Infinity, billedHours * rate));
  const serviceFee = facility?.reservationFee ?? 0;
  const totalAmount = parkingAmount + serviceFee;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const floorSpaces = spaces.filter((space) => space.zoneId === zoneId);

  const selectFacility = (next: FacilityWithAvailability) => {
    setSlug(next.slug);
    selectionInitialized.current = false;
    setSelectedSpace(null);
    setFloorId(undefined);
    setZoneId(undefined);
    navigate(`/booking/${next.slug}`, { replace: true });
  };

  const validateTime = () => {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      setTimeError(t('errors.required'));
      return false;
    }
    if (start < Date.now() - 5 * 60_000) {
      setTimeError(t('errors.datePast'));
      return false;
    }
    if (end <= start) {
      setTimeError(t('errors.dateOrder'));
      return false;
    }
    const duration = hoursBetween(startsAt, endsAt);
    if (duration < 1) {
      setTimeError(t('errors.tooShort'));
      return false;
    }
    if (duration > 168) {
      setTimeError(t('errors.tooLong'));
      return false;
    }
    setTimeError('');
    return true;
  };

  const applyDuration = (hoursToAdd: number) => {
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + hoursToAdd * 3_600_000);
    setEndsAt(toLocalIso(end));
    setTimeError('');
  };

  const next = async () => {
    setStepsError('');
    if (step === 1 && !validateTime()) return;
    if (step === 2) {
      if (!selectedSpace) {
        setStepsError(t('errors.spaceRequired'));
        return;
      }
      try {
        const result = await availability.refetch();
        if (!result.data?.available) {
          setStepsError(t('booking.availabilityFail'));
          setSelectedSpace(null);
          return;
        }
        toast.success(t('booking.availabilityOk'));
      } catch {
        setStepsError(t('errors.network'));
        return;
      }
    }
    setStep((current) => Math.min(6, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setStepsError('');
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmBooking = async () => {
    if (!facility || !selectedSpace || !zoneId || !floorId || !vehicleId) return;
    if (!terms) {
      setStepsError(t('errors.termsRequired'));
      return;
    }
    setStepsError('');
    try {
      const reservation = await createReservation.mutateAsync({
        facilityId: facility.id,
        floorId,
        zoneId,
        spaceId: selectedSpace.id,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        vehicleId,
        paymentMethod,
      });
      setCreated(reservation);
      setStep(6);
      toast.success(t('booking.successTitle'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SPACE_UNAVAILABLE') {
        setSelectedSpace(null);
        setStep(2);
        setStepsError(t('errors.spaceUnavailable'));
      } else if (error instanceof ApiError && error.code === 'PAYMENT_FAILED') {
        setStepsError(t('booking.paymentFailed'));
      } else {
        setStepsError(t('errors.generic'));
      }
    }
  };

  const saveVehicle = async () => {
    if (vehicleForm.plate.trim().length < 5) {
      setVehicleError(t('errors.plate'));
      return;
    }
    if (!vehicleForm.make.trim() || !vehicleForm.model.trim()) {
      setVehicleError(t('errors.required'));
      return;
    }
    try {
      const vehicle = await createVehicle.mutateAsync({
        plate: vehicleForm.plate.toUpperCase().trim(),
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        color: vehicleForm.color.trim() || '—',
        year: Number(vehicleForm.year) || new Date().getFullYear(),
      });
      setVehicleId(vehicle.id);
      setVehicleOpen(false);
      setVehicleForm({ plate: '', make: '', model: '', color: '', year: '2020' });
      setVehicleError('');
      toast.success(t('user.addVehicle'));
    } catch (error) {
      setVehicleError(error instanceof ApiError ? error.message : t('errors.generic'));
    }
  };

  const canContinue =
    (step === 0 && Boolean(facility)) ||
    (step === 1 && Boolean(startsAt && endsAt)) ||
    step === 2 ||
    step === 3 ||
    step === 4 ||
    step === 5;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label={t('common.appName')}>
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher compact />
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft />}>
              <Link to="/search">{t('booking.backToSearch')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5">
          <h1 className="font-display text-[24px] font-bold tracking-[-0.03em] text-foreground sm:text-[30px]">
            {step === 6 ? t('booking.successTitle') : t('booking.title')}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {step === 6 ? t('booking.successText') : t('booking.subtitle')}
          </p>
        </div>

        {step < 6 && (
          <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm sm:px-6">
            <Stepper
              current={step}
              steps={STEP_KEYS.map((key) => ({ label: t(key) }))}
            />
            <p className="mt-3 text-center text-[11px] font-medium text-muted-foreground sm:hidden">
              {t('booking.stepOf', { current: step + 1, total: 7 })}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            {step === 0 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{t('booking.step1')}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">{t('home.featuredSubtitle')}</p>
                {facilitiesLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {facilities.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectFacility(item)}
                        className={cn(
                          'flex gap-3 rounded-xl border p-3 text-left transition-colors',
                          facility?.id === item.id
                            ? 'border-gold-400 bg-gold-50/50 ring-1 ring-gold-400 dark:bg-gold-500/5'
                            : 'border-border hover:border-ink-300 dark:hover:border-navy-700',
                        )}
                      >
                        <FacilityImage
                          src={item.image}
                          alt={tx(item.name)}
                          className="size-16 shrink-0 rounded-lg"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-foreground">{tx(item.name)}</span>
                            {facility?.id === item.id && (
                              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-950">
                                <Check className="size-3" />
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="size-3" />
                            <span className="truncate">{tx(item.address)}</span>
                          </span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <Badge tone={item.availableSpaces > 0 ? 'success' : 'danger'} size="sm" dot>
                              {item.availableSpaces}
                            </Badge>
                            <span className="text-[11px] font-medium text-foreground">
                              {formatAmount(item.hourlyRate, language)} / {t('common.hours')}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{t('booking.selectDate')}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">{t('booking.holdNotice')}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label={t('booking.startAt')} htmlFor="booking-start" required>
                    <Input
                      id="booking-start"
                      type="datetime-local"
                      value={startsAt}
                      min={toLocalIso(new Date())}
                      onChange={(event) => {
                        setStartsAt(event.target.value);
                        setTimeError('');
                      }}
                    />
                  </Field>
                  <Field label={t('booking.endAt')} htmlFor="booking-end" required>
                    <Input
                      id="booking-end"
                      type="datetime-local"
                      value={endsAt}
                      min={startsAt}
                      onChange={(event) => {
                        setEndsAt(event.target.value);
                        setTimeError('');
                      }}
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { label: `1 ${t('common.hours')}`, value: 1 },
                    { label: `2 ${t('common.hours')}`, value: 2 },
                    { label: `4 ${t('common.hours')}`, value: 4 },
                    { label: `24 ${t('common.hours')}`, value: 24 },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applyDuration(option.value)}
                      className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-gold-300 hover:text-foreground"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-[12px] text-muted-foreground">
                  <CalendarDays className="size-4" />
                  {t('booking.duration')}: <strong className="text-foreground">{formatDuration(hours, language)}</strong>
                </div>

                {timeError && <p className="mt-3 text-[12px] font-medium text-destructive">{timeError}</p>}
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{t('booking.selectSpace')}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {t('facility.floor')} / {t('facility.zone')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {floors.map((floor) => (
                    <button
                      key={floor.id}
                      type="button"
                      onClick={() => {
                        setFloorId(floor.id);
                        setSelectedSpace(null);
                        selectionInitialized.current = true;
                      }}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                        floor.id === floorId
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {floor.name}
                    </button>
                  ))}
                  {zones.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setZoneId(item.id);
                        setSelectedSpace(null);
                        selectionInitialized.current = true;
                      }}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
                        item.id === zoneId
                          ? 'border-gold-400 bg-gold-50 text-gold-700 dark:bg-gold-500/10 dark:text-gold-300'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {item.name} · {t(ZONE_TYPE_KEYS[item.type])}
                    </button>
                  ))}
                </div>

                <ParkingMap
                  className="mt-4"
                  spaces={floorSpaces}
                  selectedSpaceId={selectedSpace?.id ?? null}
                  onSelectSpace={(space) => {
                    setSelectedSpace(space);
                    setStepsError('');
                  }}
                />

                {selectedSpace ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <p className="text-[12px] font-medium text-emerald-800 dark:text-emerald-200">
                      {selectedSpace.code} · {formatAmount(rate, language)} / {t('common.hours')}
                    </p>
                    <Badge tone="success" size="sm" dot>
                      {t('status.available')}
                    </Badge>
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-muted-foreground">{t('booking.noSpaceSelected')}</p>
                )}
                {paramSpaceCode && !selectedSpace && spaces.length === 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{paramSpaceCode}</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold text-foreground">{t('booking.selectVehicle')}</h2>
                  <Button variant="outline" size="sm" leftIcon={<Plus />} onClick={() => setVehicleOpen(true)}>
                    {t('booking.addVehicle')}
                  </Button>
                </div>

                {vehiclesLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-border px-5 py-10 text-center">
                    <Car className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-foreground">{t('user.noVehiclesTitle')}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{t('user.noVehiclesText')}</p>
                    <Button className="mt-4" leftIcon={<Plus />} onClick={() => setVehicleOpen(true)}>
                      {t('user.addVehicle')}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {vehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => setVehicleId(vehicle.id)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                          vehicle.id === vehicleId
                            ? 'border-gold-400 bg-gold-50/50 ring-1 ring-gold-400 dark:bg-gold-500/5'
                            : 'border-border hover:border-ink-300 dark:hover:border-navy-700',
                        )}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-navy-700 dark:text-navy-300">
                          <Car className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold uppercase tracking-wide text-foreground">
                            {vehicle.plate}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {vehicle.make} {vehicle.model} · {vehicle.color}
                          </span>
                        </span>
                        {vehicle.id === vehicleId && (
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-950">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{t('booking.summary')}</h2>
                <dl className="mt-4 divide-y divide-border rounded-xl border border-border px-4">
                  <DetailRow label={t('booking.facility')}>{facility ? tx(facility.name) : '—'}</DetailRow>
                  <DetailRow label={t('booking.space')}>
                    {selectedSpace?.code ?? '—'} · {floorId ? floors.find((floor) => floor.id === floorId)?.name : ''}
                  </DetailRow>
                  <DetailRow label={t('facility.zone')}>{zone?.name ?? '—'}</DetailRow>
                  <DetailRow label={t('booking.time')}>
                    {formatFullDateTime(startsAt, language)}
                    <br />
                    {formatFullDateTime(endsAt, language)}
                  </DetailRow>
                  <DetailRow label={t('booking.duration')}>{formatDuration(hours, language)}</DetailRow>
                  <DetailRow label={t('booking.vehicle')}>
                    {selectedVehicle ? `${selectedVehicle.plate} · ${selectedVehicle.make} ${selectedVehicle.model}` : '—'}
                  </DetailRow>
                </dl>
                <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      {t('booking.price')} ({billedHours} × {formatAmount(rate, language)})
                    </span>
                    <span className="font-medium text-foreground">{formatAmount(parkingAmount, language)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{t('booking.serviceFee')}</span>
                    <span className="font-medium text-foreground">{formatAmount(serviceFee, language)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                    <span className="text-foreground">{t('booking.total')}</span>
                    <span className="text-foreground">{formatAmount(totalAmount, language)}</span>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{t('booking.payWith')}</h2>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                          paymentMethod === method.value
                            ? 'border-gold-400 bg-gold-50/50 ring-1 ring-gold-400 dark:bg-gold-500/5'
                            : 'border-border hover:border-ink-300 dark:hover:border-navy-700',
                        )}
                      >
                        <span className="grid size-9 place-items-center rounded-lg bg-muted text-navy-700 dark:text-navy-300">
                          <Icon className="size-4" />
                        </span>
                        <span className="flex-1 text-[13px] font-semibold text-foreground">{t(method.labelKey)}</span>
                        {paymentMethod === method.value && (
                          <span className="grid size-5 place-items-center rounded-full bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-950">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12px] leading-relaxed text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  {t('booking.paymentNote')}
                </div>

                <div className="mt-4">
                  <CheckboxField
                    id="booking-terms"
                    checked={terms}
                    onCheckedChange={(checked) => {
                      setTerms(checked === true);
                      setStepsError('');
                    }}
                    label={t('booking.terms')}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <span className="text-[13px] text-muted-foreground">{t('booking.total')}</span>
                  <span className="font-display text-xl font-bold text-foreground">
                    {formatAmount(totalAmount, language)}
                  </span>
                </div>
              </div>
            )}

            {step === 6 && created && (
              <div className="text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <CheckCircle2 className="size-7" />
                </div>
                <h2 className="mt-3 font-display text-xl font-bold text-foreground">{t('booking.successTitle')}</h2>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">{t('booking.successText')}</p>
                <div className="mx-auto mt-5 max-w-sm">
                  <TicketCard reservation={created} facility={facility ?? undefined} showActions={false} />
                </div>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <Button asChild leftIcon={<Ticket />}>
                    <Link to={`/ticket/${created.id}`}>{t('booking.viewTicket')}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/app/reservations">{t('booking.viewReservations')}</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to="/search">{t('booking.newBooking')}</Link>
                  </Button>
                </div>
              </div>
            )}

            {stepsError && (
              <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive" role="alert">
                {stepsError}
              </p>
            )}

            {step < 6 && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="ghost" onClick={back} disabled={step === 0} leftIcon={<ArrowLeft />}>
                  {t('common.back')}
                </Button>
                {step === 5 ? (
                  <Button
                    onClick={() => void confirmBooking()}
                    loading={createReservation.isPending}
                    disabled={!terms}
                    leftIcon={<ShieldCheck />}
                  >
                    {createReservation.isPending ? t('booking.processing') : t('booking.confirmPayment')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => void next()}
                    disabled={!canContinue || availability.isFetching}
                    loading={step === 2 && availability.isFetching}
                    rightIcon={<ArrowRight />}
                  >
                    {t('common.next')}
                  </Button>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('booking.summary')}
              </p>
              {facility ? (
                <>
                  <div className="mt-3 flex gap-3">
                    <FacilityImage src={facility.image} alt={tx(facility.name)} className="size-14 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">{tx(facility.name)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{tx(facility.address)}</p>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-2 border-t border-border pt-3 text-[12px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t('booking.time')}</dt>
                      <dd className="text-right font-medium text-foreground">
                        {formatFullDateTime(startsAt, language)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t('facility.zone')}</dt>
                      <dd className="font-medium text-foreground">
                        {zone?.name ?? '—'} {selectedSpace ? `· ${selectedSpace.code}` : ''}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t('booking.duration')}</dt>
                      <dd className="font-medium text-foreground">{formatDuration(hours, language)}</dd>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-border pt-2 text-[13px]">
                      <dt className="font-semibold text-foreground">{t('booking.total')}</dt>
                      <dd className="font-bold text-foreground">{formatAmount(totalAmount, language)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-3 text-[12px] text-muted-foreground">{t('booking.step1')} — {t('common.required')}</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-sunken p-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                {t('booking.holdNotice')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('facility.rules')}</p>
            </div>
          </aside>
        </div>
      </main>

      <Modal
        open={vehicleOpen}
        onOpenChange={setVehicleOpen}
        title={t('booking.addVehicle')}
        description={t('user.noVehiclesText')}
        footer={
          <>
            <Button variant="outline" onClick={() => setVehicleOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void saveVehicle()} loading={createVehicle.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('booking.vehiclePlate')} htmlFor="vehicle-plate" required className="sm:col-span-2">
            <Input
              id="vehicle-plate"
              value={vehicleForm.plate}
              onChange={(event) => setVehicleForm((current) => ({ ...current, plate: event.target.value }))}
              placeholder="01 A 123 AB"
              className="uppercase"
            />
          </Field>
          <Field label={t('booking.vehicleMake')} htmlFor="vehicle-make" required>
            <Input
              id="vehicle-make"
              value={vehicleForm.make}
              onChange={(event) => setVehicleForm((current) => ({ ...current, make: event.target.value }))}
              placeholder="Chevrolet"
            />
          </Field>
          <Field label={t('booking.vehicleModel')} htmlFor="vehicle-model" required>
            <Input
              id="vehicle-model"
              value={vehicleForm.model}
              onChange={(event) => setVehicleForm((current) => ({ ...current, model: event.target.value }))}
              placeholder="Cobalt"
            />
          </Field>
          <Field label={t('booking.vehicleColor')} htmlFor="vehicle-color">
            <Input
              id="vehicle-color"
              value={vehicleForm.color}
              onChange={(event) => setVehicleForm((current) => ({ ...current, color: event.target.value }))}
              placeholder="Oq"
            />
          </Field>
          <Field label={t('booking.vehicleYear')} htmlFor="vehicle-year">
            <Select
              id="vehicle-year"
              value={vehicleForm.year}
              onChange={(event) => setVehicleForm((current) => ({ ...current, year: event.target.value }))}
            >
              {Array.from({ length: 26 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {vehicleError && <p className="mt-3 text-[12px] font-medium text-destructive">{vehicleError}</p>}
      </Modal>
    </div>
  );
}
