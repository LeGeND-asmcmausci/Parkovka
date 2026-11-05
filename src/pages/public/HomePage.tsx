import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  CarFront,
  ChevronDown,
  CircleCheck,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Radar,
  ScanLine,
  Search,
  ShieldCheck,
  Star,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFacilities, useFacilityReviews } from '@/lib/api/hooks';
import { formatNumber, formatRelative } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { FacilityCard } from '@/components/facilities/FacilityCard';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';

function HeroSearch() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('tashkent');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('query', query.trim());
    if (city) params.set('city', city);
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <form
      onSubmit={submit}
      className="relative z-10 mx-auto -mt-12 w-[calc(100%-2.5rem)] max-w-4xl rounded-2xl border border-border bg-card p-2 shadow-xl sm:-mt-14"
    >
      <div className="grid gap-2 sm:grid-cols-[1.4fr_0.9fr_auto]">
        <label className="relative block">
          <span className="sr-only">{t('home.searchLabel')}</span>
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="h-12 w-full rounded-xl border border-transparent bg-muted/60 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-card"
          />
        </label>
        <label className="relative block">
          <span className="sr-only">{t('home.searchCity')}</span>
          <Select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="h-12 rounded-xl border-transparent bg-muted/60 focus:bg-card"
          >
            <option value="tashkent">Toshkent</option>
            <option value="samarkand">Samarqand</option>
            <option value="bukhara">Buxoro</option>
          </Select>
        </label>
        <Button type="submit" size="lg" className="h-12 rounded-xl px-6" leftIcon={<Search />}>
          {t('home.searchNow')}
        </Button>
      </div>
    </form>
  );
}

function SlotSketch() {
  const cells = [
    'a', 'a', 'o', 'a', 'r', 'a',
    'a', 'o', 'o', 'a', 'a', 'm',
    'r', 'a', 'a', 'a', 'o', 'a',
    'a', 'a', 'o', 'r', 'a', 'a',
  ];
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {cells.map((cell, index) => (
        <div
          key={index}
          className={cn(
            'flex h-9 items-center justify-center rounded-[5px] border text-[9px] font-semibold',
            cell === 'a' && 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
            cell === 'o' && 'border-rose-400/30 bg-rose-400/10 text-rose-300/80',
            cell === 'r' && 'border-gold-400/40 bg-gold-400/15 text-gold-300',
            cell === 'm' && 'border-violet-400/30 bg-violet-400/10 text-violet-300/70',
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
      ))}
    </div>
  );
}

function Hero() {
  const { t, language } = useI18n();
  const { data: facilities = [] } = useFacilities();
  const totalSpaces = facilities.reduce((sum, facility) => sum + facility.totalSpaces, 0);
  const cities = new Set(facilities.map((facility) => facility.city)).size;

  return (
    <section className="relative overflow-hidden bg-navy-950">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -right-40 top-0 size-[520px] rounded-full bg-navy-700/30 blur-[120px]" />
      <div className="pointer-events-none absolute -left-32 bottom-0 size-[380px] rounded-full bg-gold-500/10 blur-[100px]" />

      <div className="page-container relative pb-24 pt-14 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-[rise_0.5s_ease-out]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-gold-400" />
              </span>
              {t('home.heroEyebrow')}
            </span>
            <h1 className="mt-5 max-w-xl text-balance font-display text-[40px] font-bold leading-[1.02] tracking-[-0.035em] text-white sm:text-[52px] lg:text-[58px]">
              {t('home.heroTitle1')}{' '}
              <span className="text-gold-400">{t('home.heroTitle2')}</span>
            </h1>
            <p className="mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-white/60">
              {t('home.heroSubtitle')}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild variant="accent" size="lg">
                <Link to="/search">
                  {t('home.heroCtaPrimary')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/15 bg-white/[0.03] text-white shadow-none hover:bg-white/[0.08]"
              >
                <Link to="/#how-it-works">{t('home.heroCtaSecondary')}</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-white/50">
              {[t('home.trustQr'), t('home.trust24'), t('home.trustOnline')].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CircleCheck className="size-3.5 text-gold-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-[rise_0.6s_ease-out]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Markaziy Park</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white">
                    <MapPin className="size-3.5 text-gold-400" /> Amir Temur, 15
                  </p>
                </div>
                <Badge tone="success" dot className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  12 {t('common.free').toLowerCase()}
                </Badge>
              </div>
              <SlotSketch />
              <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2.5">
                <span className="text-[11px] text-white/50">{t('facility.hourly')}</span>
                <span className="text-sm font-semibold text-white">6 000 so‘m</span>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white p-3 shadow-xl sm:-left-8">
              <span className="grid size-9 place-items-center rounded-lg bg-navy-900 text-gold-400">
                <QrCode className="size-5" />
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
                  {t('qr.ticket')}
                </p>
                <p className="text-xs font-bold text-ink-900">PVK-4F2A9C</p>
              </div>
            </div>

            <div className="absolute -right-2 -top-5 hidden items-center gap-2 rounded-xl border border-white/10 bg-navy-900/90 px-3 py-2 shadow-lg backdrop-blur sm:flex">
              <span className="grid size-7 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                <ScanLine className="size-4" />
              </span>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/40">QR scan</p>
                <p className="text-[11px] font-semibold text-white">0.8 s</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-3 gap-4 border-t border-white/10 pt-6 sm:max-w-lg">
          {[
            { value: facilities.length || '—', label: t('home.heroStatFacilities') },
            { value: totalSpaces ? formatNumber(totalSpaces, language) : '—', label: t('home.heroStatSpaces') },
            { value: cities || '—', label: t('home.heroStatCities') },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
      <HeroSearch />
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-balance font-display text-[28px] font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-[34px]">
          {title}
        </h2>
        {description && (
          <p className="mt-2.5 text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function FeaturedFacilities() {
  const { t } = useI18n();
  const { data: facilities = [], isLoading } = useFacilities({ sort: 'recommended' });
  const featured = facilities.slice(0, 3);

  return (
    <section className="page-container py-20">
      <SectionHeading
        eyebrow={t('home.featuredEyebrow')}
        title={t('home.featuredTitle')}
        description={t('home.featuredSubtitle')}
        action={
          <Button asChild variant="outline" size="sm" rightIcon={<ArrowRight />}>
            <Link to="/search">{t('home.seeAll')}</Link>
          </Button>
        }
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
                <Skeleton className="aspect-[16/10] rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          : featured.map((facility) => <FacilityCard key={facility.id} facility={facility} />)}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  const steps: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Search, title: t('home.howStep1Title'), text: t('home.howStep1Text') },
    { icon: CalendarCheck, title: t('home.howStep2Title'), text: t('home.howStep2Text') },
    { icon: CreditCard, title: t('home.howStep3Title'), text: t('home.howStep3Text') },
    { icon: QrCode, title: t('home.howStep4Title'), text: t('home.howStep4Text') },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-border bg-surface-sunken/60 py-20">
      <div className="page-container">
        <SectionHeading
          eyebrow={t('home.howEyebrow')}
          title={t('home.howTitle')}
          description={t('home.howSubtitle')}
        />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-lg bg-navy-900 text-gold-400 dark:bg-gold-500 dark:text-navy-950">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-display text-3xl font-bold text-ink-100 dark:text-white/10">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-[15px] font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Benefits() {
  const { t } = useI18n();
  const benefits: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Radar, title: t('home.benefit1Title'), text: t('home.benefit1Text') },
    { icon: ShieldCheck, title: t('home.benefit2Title'), text: t('home.benefit2Text') },
    { icon: BadgeCheck, title: t('home.benefit3Title'), text: t('home.benefit3Text') },
    { icon: Zap, title: t('home.benefit4Title'), text: t('home.benefit4Text') },
    { icon: CarFront, title: t('home.benefit5Title'), text: t('home.benefit5Text') },
    { icon: Briefcase, title: t('home.benefit6Title'), text: t('home.benefit6Text') },
  ];

  return (
    <section className="page-container py-20">
      <SectionHeading
        eyebrow={t('home.benefitsEyebrow')}
        title={t('home.benefitsTitle')}
        description={t('home.benefitsSubtitle')}
      />
      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <div key={benefit.title} className="group bg-card p-6 transition-colors hover:bg-muted/40">
              <span className="grid size-10 place-items-center rounded-lg border border-border bg-muted text-navy-700 transition-colors group-hover:border-gold-300 group-hover:bg-gold-50 group-hover:text-gold-700 dark:text-navy-300 dark:group-hover:bg-gold-500/10 dark:group-hover:text-gold-300">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-[15px] font-semibold text-foreground">{benefit.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{benefit.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QrSection() {
  const { t } = useI18n();
  const points = [t('home.qrPoint1'), t('home.qrPoint2'), t('home.qrPoint3')];

  return (
    <section id="qr-parking" className="scroll-mt-24 py-10">
      <div className="page-container">
        <div className="relative overflow-hidden rounded-2xl bg-navy-950 px-6 py-12 sm:px-10 lg:px-14">
          <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" />
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gold-500/15 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-400">
                {t('home.qrEyebrow')}
              </p>
              <h2 className="mt-2 max-w-lg text-balance font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-white sm:text-[36px]">
                {t('home.qrTitle')}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">{t('home.qrText')}</p>
              <ul className="mt-6 space-y-3">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[13px] text-white/75">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-gold-400" />
                    {point}
                  </li>
                ))}
              </ul>
              <Button asChild variant="accent" className="mt-7">
                <Link to="/search">
                  {t('home.qrCta')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="mx-auto w-full max-w-[280px]">
              <div className="rounded-2xl bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                      {t('qr.ticket')}
                    </p>
                    <p className="text-sm font-bold text-ink-900">PVK-4F2A9C</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                    {t('status.confirmed')}
                  </span>
                </div>
                <div className="flex justify-center py-5">
                  <QRCodeSVG value="PVK-4F2A9C" size={152} level="M" bgColor="#ffffff" fgColor="#0b1b33" />
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 text-[10px]">
                  <div>
                    <p className="text-ink-400">{t('qr.facility')}</p>
                    <p className="mt-0.5 font-semibold text-ink-900">Markaziy Park</p>
                  </div>
                  <div>
                    <p className="text-ink-400">{t('qr.space')}</p>
                    <p className="mt-0.5 font-semibold text-ink-900">P1-A04</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Payments() {
  const { t } = useI18n();
  const providers = [
    { name: 'Payme', color: 'bg-[#33cccc]', text: 'P' },
    { name: 'Click', color: 'bg-[#0a58ca]', text: 'C' },
    { name: 'Uzcard', color: 'bg-[#00a651]', text: 'U' },
    { name: 'Humo', color: 'bg-[#7c3aed]', text: 'H' },
  ];

  return (
    <section id="pricing" className="scroll-mt-24 border-y border-border bg-surface-sunken/60 py-16">
      <div className="page-container grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
            {t('home.paymentsEyebrow')}
          </p>
          <h2 className="mt-2 font-display text-[28px] font-bold tracking-[-0.025em] text-foreground sm:text-[32px]">
            {t('home.paymentsTitle')}
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground">{t('home.paymentsText')}</p>
        </div>
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {providers.map((provider) => (
              <div
                key={provider.name}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-lg font-display text-base font-bold text-white',
                    provider.color,
                  )}
                >
                  {provider.text}
                </span>
                <span className="text-xs font-semibold text-foreground">{provider.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            {t('home.paymentsNote')}
          </p>
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  const { t, tx, language } = useI18n();
  const { data: facilities = [] } = useFacilities();
  const first = useFacilityReviews(facilities[0]?.id);
  const second = useFacilityReviews(facilities[1]?.id);
  const third = useFacilityReviews(facilities[2]?.id);

  const reviews = useMemo(() => {
    const all = [...(first.data ?? []), ...(second.data ?? []), ...(third.data ?? [])];
    return all.slice(0, 3);
  }, [first.data, second.data, third.data]);

  return (
    <section className="page-container py-20">
      <SectionHeading
        eyebrow={t('home.reviewsEyebrow')}
        title={t('home.reviewsTitle')}
        description={t('home.reviewsSubtitle')}
      />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {reviews.length === 0
          ? Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-xl border border-border bg-card p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-4 h-16 w-full" />
              </div>
            ))
          : reviews.map((review) => {
              const facility = facilities.find((item) => item.id === review.facilityId);
              return (
                <figure key={review.id} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={cn(
                          'size-3.5',
                          index < review.rating ? 'fill-accent text-accent' : 'fill-transparent text-ink-300',
                        )}
                      />
                    ))}
                  </div>
                  <blockquote className="mt-3 flex-1 text-[13px] leading-relaxed text-foreground/90">
                    “{review.comment}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-2.5 border-t border-border pt-4">
                    <Avatar name={review.userName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-foreground">{review.userName}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {facility ? tx(facility.name) : ''} · {formatRelative(review.createdAt, language)}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              );
            })}
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  ['home.faq1Q', 'home.faq1A'],
  ['home.faq2Q', 'home.faq2A'],
  ['home.faq3Q', 'home.faq3A'],
  ['home.faq4Q', 'home.faq4A'],
  ['home.faq5Q', 'home.faq5A'],
  ['home.faq6Q', 'home.faq6A'],
] as const;

function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 border-t border-border bg-surface-sunken/60 py-20">
      <div className="page-container grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
            {t('home.faqEyebrow')}
          </p>
          <h2 className="mt-2 font-display text-[30px] font-bold tracking-[-0.025em] text-foreground">
            {t('home.faqTitle')}
          </h2>
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground">{t('home.contactTitle')}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('home.contactText')}</p>
            <a
              href="tel:+998712000555"
              className="mt-4 flex items-center gap-2 text-sm font-medium text-navy-700 hover:underline dark:text-navy-300"
            >
              <Phone className="size-4" /> +998 71 200 05 55
            </a>
            <a
              href="mailto:hello@parkovka.uz"
              className="mt-2 flex items-center gap-2 text-sm font-medium text-navy-700 hover:underline dark:text-navy-300"
            >
              <Mail className="size-4" /> hello@parkovka.uz
            </a>
          </div>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {FAQ_ITEMS.map(([question, answer], index) => {
            const expanded = open === index;
            return (
              <div key={question}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : index)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="text-[14px] font-medium text-foreground">{t(question)}</span>
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      expanded && 'rotate-180',
                    )}
                  />
                </button>
                {expanded && (
                  <p className="px-5 pb-4 text-[13px] leading-relaxed text-muted-foreground">{t(answer)}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const { t } = useI18n();
  const toast = useToast();
  const [values, setValues] = useState({ name: '', phone: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = t('errors.required');
    if (values.phone.trim().length < 7) next.phone = t('errors.required');
    if (values.message.trim().length < 5) next.message = t('errors.min', { min: 5 });
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const body = `${values.name}\n${values.phone}\n\n${values.message}`;
    window.location.href = `mailto:hello@parkovka.uz?subject=${encodeURIComponent(
      'Parkovka saytidan xabar',
    )}&body=${encodeURIComponent(body)}`;
    toast.info(t('home.contactCta'), t('home.contactText'));
  };

  return (
    <section id="contact" className="scroll-mt-24 page-container py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
            {t('home.contactEyebrow')}
          </p>
          <h2 className="mt-2 font-display text-[30px] font-bold tracking-[-0.025em] text-foreground">
            {t('home.contactTitle')}
          </h2>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground">{t('home.contactText')}</p>

          <div className="mt-7 space-y-4">
            {[
              { icon: Phone, label: t('home.contactPhone'), value: '+998 71 200 05 55', href: 'tel:+998712000555' },
              { icon: Mail, label: t('home.contactEmail'), value: 'hello@parkovka.uz', href: 'mailto:hello@parkovka.uz' },
              { icon: MapPin, label: t('home.contactAddress'), value: t('home.contactAddressValue') },
              { icon: Clock, label: t('facility.openingHours'), value: '09:00 — 20:00' },
            ].map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-navy-700 dark:text-navy-300">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-foreground">{item.value}</p>
                  </div>
                </div>
              );
              return item.href ? (
                <a key={item.label} href={item.href} className="block transition-opacity hover:opacity-75">
                  {content}
                </a>
              ) : (
                <div key={item.label}>{content}</div>
              );
            })}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="mb-1.5 block text-[13px] font-medium text-foreground">
                {t('auth.fullName')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="contact-name"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                aria-invalid={Boolean(errors.name)}
                placeholder="Dilshod Karimov"
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="contact-phone" className="mb-1.5 block text-[13px] font-medium text-foreground">
                {t('auth.phone')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="contact-phone"
                value={values.phone}
                onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
                aria-invalid={Boolean(errors.phone)}
                placeholder={t('auth.phonePlaceholder')}
              />
              {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="contact-message" className="mb-1.5 block text-[13px] font-medium text-foreground">
              {t('facility.reviewComment')} <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="contact-message"
              value={values.message}
              onChange={(event) => setValues((current) => ({ ...current, message: event.target.value }))}
              aria-invalid={Boolean(errors.message)}
              placeholder={t('user.reviewPlaceholder')}
            />
            {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">{t('auth.secureNote')}</p>
            <Button type="submit" rightIcon={<ArrowUpRight />}>
              {t('home.contactCta')}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function FinalCta() {
  const { t } = useI18n();
  return (
    <section className="page-container pb-20">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-navy-500/10 blur-3xl" />
        <h2 className="relative mx-auto max-w-2xl text-balance font-display text-[28px] font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-[34px]">
          {t('home.ctaTitle')}
        </h2>
        <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {t('home.ctaText')}
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link to="/search">
              {t('home.ctaButton')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/register">{t('nav.register')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const { t } = useI18n();
  usePageTitle(t('common.tagline'));

  return (
    <>
      <Hero />
      <FeaturedFacilities />
      <HowItWorks />
      <Benefits />
      <QrSection />
      <Payments />
      <Reviews />
      <Faq />
      <Contact />
      <FinalCta />
    </>
  );
}
