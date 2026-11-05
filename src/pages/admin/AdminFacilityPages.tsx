import {
  Building2,
  Layers,
  MapPinned,
  Pencil,
  Plus,
  Rows3,
  SquareParking,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useAddFloor,
  useAddSpace,
  useAddZone,
  useCreateFacility,
  useDeleteFacility,
  useFacilities,
  useFloors,
  useSpaces,
  useUpdateFacility,
  useUpdateSpaceStatus,
  useZones,
} from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/errors';
import { formatAmount, formatRelative } from '@/lib/format';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type {
  Facility,
  FacilityType,
  FacilityWithAvailability,
  ParkingSpace,
  SpaceStatus,
  ZoneType,
} from '@/lib/types';
import {
  CITY_LABELS,
  FACILITY_TYPE_KEYS,
  ZONE_TYPE_KEYS,
} from '@/components/facilities/facility-utils';
import { LocationFilters } from '@/components/dashboard/LocationFilters';
import { ParkingMap } from '@/components/map/ParkingMap';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader, StatCard } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { EmptyState, PageSkeleton } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type DataColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

interface FacilityFormState {
  nameUz: string;
  nameRu: string;
  nameEn: string;
  addressUz: string;
  addressRu: string;
  addressEn: string;
  districtUz: string;
  districtRu: string;
  districtEn: string;
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  city: Facility['city'];
  type: FacilityType;
  hourlyRate: string;
  dailyCap: string;
  capacity: string;
  status: Facility['status'];
}

const blankFacility: FacilityFormState = {
  nameUz: '',
  nameRu: '',
  nameEn: '',
  addressUz: '',
  addressRu: '',
  addressEn: '',
  districtUz: '',
  districtRu: '',
  districtEn: '',
  descriptionUz: '',
  descriptionRu: '',
  descriptionEn: '',
  city: 'tashkent',
  type: 'MALL',
  hourlyRate: '10000',
  dailyCap: '60000',
  capacity: '60',
  status: 'ACTIVE',
};

const CITY_TONE: Record<Facility['city'], BadgeTone> = {
  tashkent: 'navy',
  samarkand: 'gold',
  bukhara: 'info',
};

export function AdminFacilitiesPage() {
  const { t, tx, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const facilities = useFacilities();
  const createFacility = useCreateFacility();
  const updateFacility = useUpdateFacility();
  const deleteFacility = useDeleteFacility();
  const toast = useToast();
  const [open, setOpen] = useState(() => params.get('new') === '1');
  const [editing, setEditing] = useState<Facility | null>(null);
  const [form, setForm] = useState<FacilityFormState>(blankFacility);
  const [error, setError] = useState('');
  const [city, setCity] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Facility | null>(null);
  usePageTitle(t('admin.facilitiesTitle'));

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null);
      setForm(blankFacility);
      setOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankFacility);
    setError('');
    setOpen(true);
  };

  const openEdit = (facility: Facility) => {
    setEditing(facility);
    setForm({
      nameUz: facility.name.uz,
      nameRu: facility.name.ru,
      nameEn: facility.name.en,
      addressUz: facility.address.uz,
      addressRu: facility.address.ru,
      addressEn: facility.address.en,
      districtUz: facility.district.uz,
      districtRu: facility.district.ru,
      districtEn: facility.district.en,
      descriptionUz: facility.description.uz,
      descriptionRu: facility.description.ru,
      descriptionEn: facility.description.en,
      city: facility.city,
      type: facility.type,
      hourlyRate: String(facility.hourlyRate),
      dailyCap: String(facility.dailyCap),
      capacity: String(facility.totalSpaces),
      status: facility.status,
    });
    setError('');
    setOpen(true);
  };

  const save = () => {
    if (!form.nameUz.trim() || !form.nameRu.trim() || !form.nameEn.trim()) {
      setError(t('errors.required'));
      return;
    }
    if (!form.addressUz.trim() || !form.districtUz.trim()) {
      setError(t('errors.required'));
      return;
    }
    const hourlyRate = Number(form.hourlyRate);
    const dailyCap = Number(form.dailyCap);
    const capacity = Number(form.capacity);
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0 || !Number.isFinite(dailyCap) || dailyCap < hourlyRate) {
      setError(t('errors.min', { min: 1 }));
      return;
    }
    const localized = {
      name: { uz: form.nameUz.trim(), ru: form.nameRu.trim(), en: form.nameEn.trim() },
      address: { uz: form.addressUz.trim(), ru: form.addressRu.trim(), en: form.addressEn.trim() },
      district: { uz: form.districtUz.trim(), ru: form.districtRu.trim(), en: form.districtEn.trim() },
      description: {
        uz: form.descriptionUz.trim(),
        ru: form.descriptionRu.trim(),
        en: form.descriptionEn.trim(),
      },
    };
    const onSuccess = () => {
      toast.success(t('user.saved'));
      setOpen(false);
    };
    const onError = (mutationError: unknown) => {
      setError(mutationError instanceof ApiError ? mutationError.message : t('common.somethingWrong'));
    };
    if (editing) {
      updateFacility.mutate(
        {
          id: editing.id,
          patch: {
            ...localized,
            city: form.city,
            type: form.type,
            hourlyRate,
            dailyCap,
            status: form.status,
          },
        },
        { onSuccess, onError },
      );
    } else {
      if (!Number.isFinite(capacity) || capacity < 1) {
        setError(t('errors.min', { min: 1 }));
        return;
      }
      createFacility.mutate(
        {
          ...localized,
          city: form.city,
          type: form.type,
          hourlyRate,
          dailyCap,
          capacity,
        },
        { onSuccess, onError },
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteFacility.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(t('common.delete'));
        setDeleteTarget(null);
      },
      onError: (mutationError) => {
        toast.error(t('common.somethingWrong'), mutationError instanceof ApiError ? mutationError.message : undefined);
      },
    });
  };

  const rows = (facilities.data ?? []).filter((facility) => city === 'all' || facility.city === city);

  const columns: DataColumn<FacilityWithAvailability>[] = [
    {
      id: 'name',
      header: t('admin.facilityName'),
      cell: (facility) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">{tx(facility.name)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{tx(facility.address)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/80">/{facility.slug}</p>
        </div>
      ),
      sortValue: (facility) => facility.name.en,
    },
    {
      id: 'city',
      header: t('admin.city'),
      cell: (facility) => (
        <Badge tone={CITY_TONE[facility.city]} size="sm">
          {CITY_LABELS[facility.city][language]}
        </Badge>
      ),
    },
    {
      id: 'type',
      header: t('admin.categories'),
      cell: (facility) => <Badge tone="outline" size="sm">{t(FACILITY_TYPE_KEYS[facility.type])}</Badge>,
    },
    {
      id: 'spaces',
      header: t('admin.capacity'),
      cell: (facility) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">{facility.totalSpaces}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {facility.availableSpaces} {t('common.free').toLowerCase()}
          </p>
        </div>
      ),
      sortValue: (facility) => facility.totalSpaces,
      align: 'right',
    },
    {
      id: 'rate',
      header: t('admin.rate'),
      cell: (facility) => (
        <div className="text-right">
          <p className="text-[13px] font-semibold text-foreground">{formatAmount(facility.hourlyRate, language)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t('admin.dailyCap')}: {formatAmount(facility.dailyCap, language)}
          </p>
        </div>
      ),
      sortValue: (facility) => facility.hourlyRate,
      align: 'right',
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (facility) => <StatusBadge status={facility.status} />,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      mobileHidden: true,
      cell: (facility) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t('nav.floors')}>
            <Link to={`/admin/floors?facility=${facility.id}`}>
              <Layers />
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')} onClick={() => openEdit(facility)}>
            <Pencil />
          </Button>
          <Button
            variant="danger-ghost"
            size="icon-sm"
            aria-label={t('common.delete')}
            onClick={() => setDeleteTarget(facility)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.adminArea')}
        title={t('admin.facilitiesTitle')}
        description={t('admin.facilitiesSubtitle')}
        actions={
          <Button leftIcon={<Plus />} onClick={openCreate}>
            {t('admin.addFacility')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={city} onChange={(event) => setCity(event.target.value)} className="w-48" aria-label={t('admin.city')}>
          <option value="all">{t('search.allCities')}</option>
          <option value="tashkent">{CITY_LABELS.tashkent[language]}</option>
          <option value="samarkand">{CITY_LABELS.samarkand[language]}</option>
          <option value="bukhara">{CITY_LABELS.bukhara[language]}</option>
        </Select>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <Badge tone="navy" size="sm">{rows.length} {t('admin.facilities').toLowerCase()}</Badge>
          <Badge tone="success" size="sm">
            {rows.reduce((sum, facility) => sum + facility.availableSpaces, 0)} {t('common.free').toLowerCase()}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {facilities.isLoading ? (
          <PageSkeleton />
        ) : (
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(facility) => facility.id}
            searchPlaceholder={`${t('common.search')}…`}
            searchFn={(facility, query) =>
              [
                facility.name.uz,
                facility.name.ru,
                facility.name.en,
                facility.address.uz,
                facility.slug,
              ]
                .join(' ')
                .toLowerCase()
                .includes(query)
            }
            pageSize={8}
          />
        )}
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={editing ? t('admin.editFacility') : t('admin.addFacility')}
        description={t('admin.facilitiesSubtitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={createFacility.isPending || updateFacility.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="O‘zbekcha nomi" htmlFor="facility-name-uz" required>
              <Input id="facility-name-uz" value={form.nameUz} onChange={(event) => setForm({ ...form, nameUz: event.target.value })} />
            </Field>
            <Field label="Название (RU)" htmlFor="facility-name-ru" required>
              <Input id="facility-name-ru" value={form.nameRu} onChange={(event) => setForm({ ...form, nameRu: event.target.value })} />
            </Field>
            <Field label="English name" htmlFor="facility-name-en" required>
              <Input id="facility-name-en" value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`${t('admin.address')} (UZ)`} htmlFor="facility-address-uz" required>
              <Input id="facility-address-uz" value={form.addressUz} onChange={(event) => setForm({ ...form, addressUz: event.target.value })} />
            </Field>
            <Field label={`${t('admin.address')} (RU)`} htmlFor="facility-address-ru">
              <Input id="facility-address-ru" value={form.addressRu} onChange={(event) => setForm({ ...form, addressRu: event.target.value })} />
            </Field>
            <Field label={`${t('admin.address')} (EN)`} htmlFor="facility-address-en">
              <Input id="facility-address-en" value={form.addressEn} onChange={(event) => setForm({ ...form, addressEn: event.target.value })} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tuman (UZ)" htmlFor="facility-district-uz" required>
              <Input id="facility-district-uz" value={form.districtUz} onChange={(event) => setForm({ ...form, districtUz: event.target.value })} />
            </Field>
            <Field label="Район (RU)" htmlFor="facility-district-ru">
              <Input id="facility-district-ru" value={form.districtRu} onChange={(event) => setForm({ ...form, districtRu: event.target.value })} />
            </Field>
            <Field label="District (EN)" htmlFor="facility-district-en">
              <Input id="facility-district-en" value={form.districtEn} onChange={(event) => setForm({ ...form, districtEn: event.target.value })} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tavsif (UZ)" htmlFor="facility-description-uz">
              <Textarea
                id="facility-description-uz"
                rows={3}
                value={form.descriptionUz}
                onChange={(event) => setForm({ ...form, descriptionUz: event.target.value })}
              />
            </Field>
            <Field label="Описание (RU)" htmlFor="facility-description-ru">
              <Textarea
                id="facility-description-ru"
                rows={3}
                value={form.descriptionRu}
                onChange={(event) => setForm({ ...form, descriptionRu: event.target.value })}
              />
            </Field>
            <Field label="Description (EN)" htmlFor="facility-description-en">
              <Textarea
                id="facility-description-en"
                rows={3}
                value={form.descriptionEn}
                onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('admin.city')} htmlFor="facility-city">
              <Select id="facility-city" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value as Facility['city'] })}>
                <option value="tashkent">{CITY_LABELS.tashkent[language]}</option>
                <option value="samarkand">{CITY_LABELS.samarkand[language]}</option>
                <option value="bukhara">{CITY_LABELS.bukhara[language]}</option>
              </Select>
            </Field>
            <Field label={t('admin.categories')} htmlFor="facility-type">
              <Select id="facility-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FacilityType })}>
                {(Object.keys(FACILITY_TYPE_KEYS) as FacilityType[]).map((type) => (
                  <option key={type} value={type}>{t(FACILITY_TYPE_KEYS[type])}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.rate')} htmlFor="facility-rate" required>
              <Input
                id="facility-rate"
                type="number"
                min={1000}
                step={500}
                value={form.hourlyRate}
                onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })}
              />
            </Field>
            <Field label={t('admin.dailyCap')} htmlFor="facility-cap" required>
              <Input
                id="facility-cap"
                type="number"
                min={1000}
                step={500}
                value={form.dailyCap}
                onChange={(event) => setForm({ ...form, dailyCap: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!editing && (
              <Field label={t('admin.capacity')} htmlFor="facility-capacity" required hint={`${t('admin.addSpace')} · 1–90`}>
                <Input
                  id="facility-capacity"
                  type="number"
                  min={1}
                  max={90}
                  value={form.capacity}
                  onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                />
              </Field>
            )}
            {editing && (
              <Field label={t('common.status')} htmlFor="facility-status">
                <Select id="facility-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Facility['status'] })}>
                  <option value="ACTIVE">{t('admin.activate')}</option>
                  <option value="MAINTENANCE">{t('status.maintenance')}</option>
                  <option value="CLOSED">{t('status.closed')}</option>
                </Select>
              </Field>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t('common.delete')}
        description={t('admin.deleteFacilityConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        loading={deleteFacility.isPending}
        tone="danger"
      />
    </div>
  );
}

export function AdminFloorsPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [facilityId, setFacilityId] = useState(params.get('facility') ?? '');
  const [floorId, setFloorId] = useState('');
  const floors = useFloors(facilityId || undefined);
  const addFloor = useAddFloor();
  const toast = useToast();
  usePageTitle(t('admin.floorsTitle'));

  useEffect(() => {
    if (params.get('facility') && !facilityId) setFacilityId(params.get('facility')!);
  }, [params, facilityId]);

  const changeFacility = (id: string) => {
    setFacilityId(id);
    setFloorId('');
    params.set('facility', id);
    setParams(params, { replace: true });
  };

  const add = () => {
    if (!facilityId) return;
    addFloor.mutate(facilityId, {
      onSuccess: () => toast.success(t('user.saved')),
      onError: (error) => toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
    });
  };

  const columns: DataColumn<(NonNullable<typeof floors.data>[number])>[] = [
    {
      id: 'name',
      header: t('facility.floor'),
      cell: (floor) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">{floor.name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{floor.id}</p>
        </div>
      ),
      sortValue: (floor) => floor.level,
    },
    {
      id: 'level',
      header: 'Level',
      cell: (floor) => <span className="text-[13px] text-foreground">{floor.level}</span>,
      sortValue: (floor) => floor.level,
      align: 'center',
    },
    {
      id: 'spaces',
      header: t('nav.spaces'),
      cell: (floor) => <span className="text-[13px] font-semibold text-foreground">{floor.totalSpaces}</span>,
      sortValue: (floor) => floor.totalSpaces,
      align: 'right',
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (floor) => <StatusBadge status={floor.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.adminArea')}
        title={t('admin.floorsTitle')}
        description={t('admin.facilitiesSubtitle')}
        actions={
          <Button leftIcon={<Plus />} onClick={add} disabled={!facilityId} loading={addFloor.isPending}>
            {t('admin.addFloor')}
          </Button>
        }
      />

      <LocationFilters
        facilityId={facilityId}
        floorId={floorId}
        onFacilityChange={changeFacility}
        onFloorChange={setFloorId}
        includeZone={false}
        className="grid gap-3 sm:grid-cols-2"
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {!facilityId ? (
          <EmptyState icon={<Building2 />} title={t('admin.noData')} description={t('admin.facilitiesSubtitle')} />
        ) : floors.isLoading ? (
          <PageSkeleton />
        ) : (
          <DataTable
            data={floors.data ?? []}
            columns={columns}
            rowKey={(floor) => floor.id}
            searchPlaceholder={t('common.search')}
            searchFn={(floor, query) => floor.name.toLowerCase().includes(query)}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.facilitiesSubtitle')}</p>
    </div>
  );
}

const ZONE_TONE: Record<ZoneType, BadgeTone> = {
  STANDARD: 'neutral',
  VIP: 'gold',
  EV: 'info',
  ACCESSIBLE: 'purple',
};

export function AdminZonesPage() {
  const { t } = useI18n();
  const [facilityId, setFacilityId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const zones = useZones(floorId || undefined);
  const addZone = useAddZone();
  const toast = useToast();
  usePageTitle(t('admin.zonesTitle'));

  const changeFacility = (id: string) => {
    setFacilityId(id);
    setFloorId('');
    setZoneId('');
  };
  const changeFloor = (id: string) => {
    setFloorId(id);
    setZoneId('');
  };

  const add = () => {
    if (!floorId) return;
    addZone.mutate(floorId, {
      onSuccess: () => toast.success(t('user.saved')),
      onError: (error) => toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
    });
  };

  const columns: DataColumn<(NonNullable<typeof zones.data>[number])>[] = [
    {
      id: 'name',
      header: t('facility.zone'),
      cell: (zone) => (
        <div>
          <p className="text-[13px] font-semibold text-foreground">{zone.name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{zone.id}</p>
        </div>
      ),
    },
    {
      id: 'type',
      header: t('admin.categories'),
      cell: (zone) => <Badge tone={ZONE_TONE[zone.type]} size="sm">{t(ZONE_TYPE_KEYS[zone.type])}</Badge>,
    },
    {
      id: 'multiplier',
      header: t('admin.rate'),
      cell: (zone) => <span className="text-[13px] font-semibold text-foreground">×{zone.rateMultiplier}</span>,
      sortValue: (zone) => zone.rateMultiplier,
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.adminArea')}
        title={t('admin.zonesTitle')}
        description={t('admin.facilitiesSubtitle')}
        actions={
          <Button leftIcon={<Plus />} onClick={add} disabled={!floorId} loading={addZone.isPending}>
            {t('admin.addZone')}
          </Button>
        }
      />

      <LocationFilters
        facilityId={facilityId}
        floorId={floorId}
        zoneId={zoneId}
        onFacilityChange={changeFacility}
        onFloorChange={changeFloor}
        onZoneChange={setZoneId}
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {!floorId ? (
          <EmptyState icon={<Layers />} title={t('facility.selectFloor')} description={t('admin.facilitiesSubtitle')} />
        ) : zones.isLoading ? (
          <PageSkeleton />
        ) : (
          <DataTable
            data={zones.data ?? []}
            columns={columns}
            rowKey={(zone) => zone.id}
            searchPlaceholder={t('common.search')}
            searchFn={(zone, query) => zone.name.toLowerCase().includes(query)}
          />
        )}
      </div>
    </div>
  );
}

const SPACE_STATUSES: SpaceStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'MAINTENANCE'];

const SPACE_STATUS_KEYS: Record<SpaceStatus, TranslationKey> = {
  AVAILABLE: 'status.available',
  OCCUPIED: 'status.occupied',
  RESERVED: 'status.reserved',
  BLOCKED: 'status.blocked',
  MAINTENANCE: 'status.maintenance',
};

export function AdminSpacesPage() {
  const { t, language } = useI18n();
  const [facilityId, setFacilityId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [status, setStatus] = useState<'ALL' | SpaceStatus>('ALL');
  const spaces = useSpaces({
    facilityId: facilityId || undefined,
    floorId: floorId || undefined,
    zoneId: zoneId || undefined,
    status: status === 'ALL' ? undefined : status,
  });
  const updateStatus = useUpdateSpaceStatus();
  const addSpace = useAddSpace();
  const toast = useToast();
  usePageTitle(t('admin.spacesTitle'));

  const changeFacility = (id: string) => {
    setFacilityId(id);
    setFloorId('');
    setZoneId('');
  };
  const changeFloor = (id: string) => {
    setFloorId(id);
    setZoneId('');
  };

  const setSpaceStatus = (space: ParkingSpace, next: SpaceStatus) => {
    updateStatus.mutate(
      { id: space.id, status: next },
      {
        onSuccess: () => toast.success(`${space.code}: ${t('user.saved')}`),
        onError: (error) =>
          toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
      },
    );
  };

  const add = () => {
    if (!zoneId) return;
    addSpace.mutate(zoneId, {
      onSuccess: () => toast.success(t('user.saved')),
      onError: (error) => toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
    });
  };

  const columns: DataColumn<ParkingSpace>[] = [
    {
      id: 'code',
      header: t('admin.space'),
      cell: (space) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-foreground">{space.code}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{space.id}</p>
        </div>
      ),
      sortValue: (space) => space.code,
    },
    {
      id: 'type',
      header: t('admin.categories'),
      cell: (space) => <Badge tone={ZONE_TONE[space.type]} size="sm">{t(ZONE_TYPE_KEYS[space.type])}</Badge>,
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: (space) => <StatusBadge status={space.status} />,
      sortValue: (space) => space.status,
    },
    {
      id: 'sensor',
      header: 'Sensor',
      cell: (space) => (
        <Badge tone={space.sensor ? 'success' : 'neutral'} size="sm" dot>
          {space.sensor ? 'ON' : 'OFF'}
        </Badge>
      ),
      align: 'center',
    },
    {
      id: 'updated',
      header: t('admin.lastSeen'),
      cell: (space) => (
        <span className="text-[11px] text-muted-foreground">{formatRelative(space.updatedAt, language)}</span>
      ),
      sortValue: (space) => space.updatedAt,
    },
    {
      id: 'actions',
      header: t('common.status'),
      mobileHidden: true,
      cell: (space) => (
        <div className="flex justify-end">
          <Select
            value={space.status}
            onChange={(event) => setSpaceStatus(space, event.target.value as SpaceStatus)}
            className="h-8 w-40 text-xs"
            aria-label={`${space.code} ${t('common.status')}`}
            disabled={updateStatus.isPending}
          >
            {SPACE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(SPACE_STATUS_KEYS[item])}
              </option>
            ))}
          </Select>
        </div>
      ),
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.adminArea')}
        title={t('admin.spacesTitle')}
        description={t('admin.facilitiesSubtitle')}
        actions={
          <Button leftIcon={<Plus />} onClick={add} disabled={!zoneId} loading={addSpace.isPending}>
            {t('admin.addSpace')}
          </Button>
        }
      />

      <div className="space-y-3">
        <LocationFilters
          facilityId={facilityId}
          floorId={floorId}
          zoneId={zoneId}
          onFacilityChange={changeFacility}
          onFloorChange={changeFloor}
          onZoneChange={setZoneId}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as 'ALL' | SpaceStatus)}
            className="w-44"
            aria-label={t('common.status')}
          >
            <option value="ALL">{t('common.all')}</option>
            {SPACE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(SPACE_STATUS_KEYS[item])}
              </option>
            ))}
          </Select>
          <Badge tone="outline">{spaces.data?.length ?? 0} {t('nav.spaces').toLowerCase()}</Badge>
          {!zoneId && (
            <span className="text-xs text-muted-foreground">{t('facility.selectZone')}</span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {spaces.isLoading ? (
          <PageSkeleton />
        ) : (
          <DataTable
            data={spaces.data ?? []}
            columns={columns}
            rowKey={(space) => space.id}
            searchPlaceholder={t('common.search')}
            searchFn={(space, query) => space.code.toLowerCase().includes(query)}
            pageSize={10}
          />
        )}
      </div>
    </div>
  );
}

const MAP_STATUSES: SpaceStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED', 'MAINTENANCE'];

export function AdminMapPage() {
  const { t, language } = useI18n();
  const [facilityId, setFacilityId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [selected, setSelected] = useState<ParkingSpace | null>(null);
  const [nextStatus, setNextStatus] = useState<SpaceStatus>('AVAILABLE');
  const spaces = useSpaces({ facilityId: facilityId || undefined, floorId: floorId || undefined });
  const updateStatus = useUpdateSpaceStatus();
  const toast = useToast();
  usePageTitle(t('admin.mapTitle'));

  const changeFacility = (id: string) => {
    setFacilityId(id);
    setFloorId('');
    setZoneId('');
    setSelected(null);
  };
  const changeFloor = (id: string) => {
    setFloorId(id);
    setZoneId('');
    setSelected(null);
  };

  const counts = (spaces.data ?? []).reduce(
    (acc, space) => {
      acc[space.status] += 1;
      return acc;
    },
    { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, BLOCKED: 0, MAINTENANCE: 0 } as Record<SpaceStatus, number>,
  );

  const saveStatus = () => {
    if (!selected) return;
    updateStatus.mutate(
      { id: selected.id, status: nextStatus },
      {
        onSuccess: (updated) => {
          toast.success(`${updated.code}: ${t('user.saved')}`);
          setSelected(updated);
        },
        onError: (error) =>
          toast.error(t('common.somethingWrong'), error instanceof ApiError ? error.message : undefined),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('nav.adminArea')}
        title={t('admin.mapTitle')}
        description={t('admin.mapSubtitle')}
        actions={
          <Button asChild variant="outline" leftIcon={<Rows3 />}>
            <Link to="/admin/spaces">{t('admin.spacesTitle')}</Link>
          </Button>
        }
      />

      <LocationFilters
        facilityId={facilityId}
        floorId={floorId}
        zoneId={zoneId}
        onFacilityChange={changeFacility}
        onFloorChange={changeFloor}
        onZoneChange={setZoneId}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t('status.available')} value={counts.AVAILABLE} icon={SquareParking} tone="green" />
        <StatCard label={t('status.occupied')} value={counts.OCCUPIED} icon={SquareParking} tone="red" />
        <StatCard label={t('status.reserved')} value={counts.RESERVED} icon={SquareParking} tone="gold" />
        <StatCard label={t('status.blocked')} value={counts.BLOCKED} icon={SquareParking} tone="navy" />
        <StatCard label={t('status.maintenance')} value={counts.MAINTENANCE} icon={SquareParking} tone="violet" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          {spaces.isLoading ? (
            <PageSkeleton />
          ) : (
            <ParkingMap
              spaces={spaces.data ?? []}
              selectedSpaceId={selected?.id}
              onSelectSpace={(space) => {
                setSelected(space);
                setNextStatus(space.status);
              }}
              canSelect={() => true}
            />
          )}
        </div>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <MapPinned className="size-4 text-accent" />
            {selected ? selected.code : t('admin.spaceStatus')}
          </h2>
          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-3">
                <span className="text-xs text-muted-foreground">{t('common.status')}</span>
                <StatusBadge status={selected.status} />
              </div>
              <Field label={t('admin.spaceStatus')} htmlFor="map-space-status">
                <Select
                  id="map-space-status"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as SpaceStatus)}
                >
                  {MAP_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {t(SPACE_STATUS_KEYS[item])}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button className="w-full" onClick={saveStatus} loading={updateStatus.isPending}>
                {t('common.save')}
              </Button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {formatRelative(selected.updatedAt, language)} · {t('facility.lastUpdated')}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t('booking.noSpaceSelected')}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
