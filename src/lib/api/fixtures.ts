import type {
  AppNotification,
  AuditLog,
  Camera,
  Facility,
  Floor,
  Incident,
  LocalizedText,
  ParkingSession,
  ParkingSpace,
  Payment,
  PaymentMethod,
  PricingRule,
  Reservation,
  ReservationStatus,
  Review,
  SpaceStatus,
  User,
  Vehicle,
  Zone,
} from '@/lib/types';

export interface SystemSettings {
  companyName: string;
  supportPhone: string;
  supportEmail: string;
  defaultLanguage: 'uz' | 'ru' | 'en';
  currency: 'UZS';
  timezone: string;
  maintenanceWindow: string;
  paymentProvider: string;
  cameraProvider: string;
}

export interface FixtureState {
  facilities: Facility[];
  floors: Floor[];
  zones: Zone[];
  spaces: ParkingSpace[];
  users: User[];
  vehicles: Vehicle[];
  reservations: Reservation[];
  sessions: ParkingSession[];
  payments: Payment[];
  reviews: Review[];
  notifications: AppNotification[];
  cameras: Camera[];
  incidents: Incident[];
  auditLogs: AuditLog[];
  pricingRules: PricingRule[];
  settings: SystemSettings;
  passwords: Record<string, string>;
}

const l = (uz: string, ru: string, en: string): LocalizedText => ({ uz, ru, en });

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261105);
const rand = (min: number, max: number) => min + rng() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];

function dateAt(daysOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 36e5).toISOString();
}

function refToken(seed: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = '';
  let hash = 2166136261;
  for (const char of seed) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  for (let i = 0; i < 8; i += 1) {
    value += alphabet[Math.abs(hash >> (i * 3)) % alphabet.length];
  }
  return `PVK-${value}`;
}

interface FacilityDef {
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  address: LocalizedText;
  city: Facility['city'];
  district: LocalizedText;
  lat: number;
  lng: number;
  type: Facility['type'];
  image: string;
  hourlyRate: number;
  dailyCap: number;
  rating: number;
  reviewCount: number;
  amenities: Facility['amenities'];
  floors: number;
  zones: number;
  spacesPerZone: number;
  phone: string;
  open24h?: boolean;
}

const facilityDefs: FacilityDef[] = [
  {
    key: 'markaziy',
    name: l('Markaziy Park', 'Центральный парк', 'Central Park Parking'),
    description: l(
      'Amir Temur shoh ko‘chasi markazida joylashgan zamonaviy ko‘p qavatli parking. Biznes uchrashuvlari va shahar sayohatlari uchun qulay.',
      'Современный многоуровневый паркинг в центре проспекта Амира Темура. Удобен для деловых встреч и поездок по городу.',
      'A modern multi-storey parking facility in the heart of Amir Temur Avenue. Ideal for business meetings and city trips.',
    ),
    address: l(
      'Amir Temur shoh ko‘chasi, 15',
      'Проспект Амира Темура, 15',
      '15 Amir Temur Avenue',
    ),
    city: 'tashkent',
    district: l('Yunusobod tumani', 'Юнусабадский район', 'Yunusobod district'),
    lat: 41.3111,
    lng: 69.2797,
    type: 'BUSINESS',
    image: '/images/facility-markaziy.jpg',
    hourlyRate: 6000,
    dailyCap: 45000,
    rating: 4.8,
    reviewCount: 186,
    amenities: ['cctv', 'security', 'elevator', 'covered', 'ev', 'wifi'],
    floors: 2,
    zones: 3,
    spacesPerZone: 9,
    phone: '+998 71 200 10 15',
  },
  {
    key: 'city',
    name: l('Toshkent City', 'Ташкент Сити', 'Tashkent City'),
    description: l(
      'Toshkent City majmuasidagi keng parking. Savdo markazlari, ofislar va restoranlarga bir necha daqiqada yetib borish mumkin.',
      'Просторный паркинг в комплексе Tashkent City. Торговые центры, офисы и рестораны в нескольких минутах.',
      'A spacious parking facility in the Tashkent City complex, minutes from malls, offices and restaurants.',
    ),
    address: l(
      'Islom Karimov ko‘chasi, 1',
      'Улица Ислама Каримова, 1',
      '1 Islam Karimov Street',
    ),
    city: 'tashkent',
    district: l('Shayxontohur tumani', 'Шайхантахурский район', 'Shayxontohur district'),
    lat: 41.3176,
    lng: 69.257,
    type: 'MALL',
    image: '/images/facility-city.jpg',
    hourlyRate: 5000,
    dailyCap: 40000,
    rating: 4.6,
    reviewCount: 243,
    amenities: ['cctv', 'security', 'elevator', 'covered', 'ev', 'carWash', 'accessible'],
    floors: 3,
    zones: 3,
    spacesPerZone: 9,
    phone: '+998 71 200 10 20',
  },
  {
    key: 'chilonzor',
    name: l('Chilonzor Plaza', 'Чиланзар Плаза', 'Chilonzor Plaza'),
    description: l(
      'Chilonzor tumanidagi qulay parking. Xarid qilish va oilaviy dam olish uchun mo‘ljallangan ochiq va yopiq joylar mavjud.',
      'Удобный паркинг в Чиланзарском районе. Открытые и крытые места для покупок и семейного отдыха.',
      'Convenient parking in Chilonzor district with covered and open spaces for shopping and family outings.',
    ),
    address: l(
      'Bunyodkor shoh ko‘chasi, 56',
      'Проспект Бунёдкор, 56',
      '56 Bunyodkor Avenue',
    ),
    city: 'tashkent',
    district: l('Chilonzor tumani', 'Чиланзарский район', 'Chilonzor district'),
    lat: 41.282,
    lng: 69.203,
    type: 'MALL',
    image: '/images/facility-chilonzor.jpg',
    hourlyRate: 4000,
    dailyCap: 30000,
    rating: 4.4,
    reviewCount: 129,
    amenities: ['cctv', 'security', 'accessible', 'carWash'],
    floors: 2,
    zones: 3,
    spacesPerZone: 9,
    phone: '+998 71 200 10 30',
  },
  {
    key: 'airport',
    name: l('Toshkent Aeroporti', 'Аэропорт Ташкент', 'Tashkent Airport Parking'),
    description: l(
      'Xalqaro aeroport yonidagi 24/7 parking. Uzoq muddatli to‘xtash va tezkor transfer uchun ideal.',
      'Круглосуточный паркинг рядом с международным аэропортом. Идеален для длительной стоянки и быстрого трансфера.',
      '24/7 parking next to the international airport. Ideal for long stays and quick transfers.',
    ),
    address: l(
      'Toshkent xalqaro aeroporti',
      'Международный аэропорт Ташкент',
      'Tashkent International Airport',
    ),
    city: 'tashkent',
    district: l('Yashnobod tumani', 'Яшнабадский район', 'Yashnobod district'),
    lat: 41.2579,
    lng: 69.2812,
    type: 'AIRPORT',
    image: '/images/facility-airport.jpg',
    hourlyRate: 3500,
    dailyCap: 50000,
    rating: 4.5,
    reviewCount: 312,
    amenities: ['cctv', 'security', 'ev', 'covered', 'accessible', 'wifi'],
    floors: 3,
    zones: 3,
    spacesPerZone: 9,
    phone: '+998 71 200 10 40',
    open24h: true,
  },
  {
    key: 'registon',
    name: l('Registon Parking', 'Паркин�� Регистан', 'Registan Parking'),
    description: l(
      'Registon majmuasi yaqinidagi tarixiy markaz parkingi. Sayyohlar va mahalliy aholi uchun qulay joylashuv.',
      'Паркинг в историческом центре рядом с ансамблем Регистан. Удобное расположение для туристов и местных жителей.',
      'Historic centre parking next to the Registan ensemble. Convenient for tourists and locals alike.',
    ),
    address: l('Registon ko‘chasi, 1', 'Улица Регистан, 1', '1 Registan Street'),
    city: 'samarkand',
    district: l('Samarqand markazi', 'Центр Самарканда', 'Samarkand centre'),
    lat: 39.6547,
    lng: 66.9597,
    type: 'PUBLIC',
    image: '/images/facility-registon.jpg',
    hourlyRate: 3000,
    dailyCap: 24000,
    rating: 4.7,
    reviewCount: 98,
    amenities: ['cctv', 'security', 'accessible'],
    floors: 2,
    zones: 2,
    spacesPerZone: 9,
    phone: '+998 66 200 10 50',
  },
  {
    key: 'ark',
    name: l('Buxoro Ark', 'Бухарский Арк', 'Bukhara Ark Parking'),
    description: l(
      'Buxoro Ark qal’asi yaqinidagi shinam parking. Mehmonxona va tarixiy joylarga piyoda yetib borish mumkin.',
      'Уютный паркинг рядом с цитаделью Арк в Бухаре. Отели и исторические места в пешей доступности.',
      'A cosy parking facility near the Ark citadel in Bukhara. Hotels and historic sites within walking distance.',
    ),
    address: l('Mustaqillik ko‘chasi, 7', 'Улица Мустакиллик, 7', '7 Mustaqillik Street'),
    city: 'bukhara',
    district: l('Buxoro markazi', 'Центр Бухары', 'Bukhara centre'),
    lat: 39.7747,
    lng: 64.4112,
    type: 'HOTEL',
    image: '/images/facility-ark.jpg',
    hourlyRate: 3500,
    dailyCap: 28000,
    rating: 4.5,
    reviewCount: 76,
    amenities: ['cctv', 'security', 'covered', 'wifi'],
    floors: 2,
    zones: 2,
    spacesPerZone: 9,
    phone: '+998 65 200 10 60',
  },
];

const floorNames = ['P1', 'P2', 'P3'];
const zoneNames = ['A', 'B', 'C'];
const zoneTypes: Zone['type'][] = ['STANDARD', 'EV', 'VIP'];
const zoneMultipliers = [1, 1.2, 1.5];

const statusPool: SpaceStatus[] = Array.from({ length: 100 }, (_, index) => {
  if (index < 56) return 'AVAILABLE';
  if (index < 82) return 'OCCUPIED';
  if (index < 94) return 'RESERVED';
  if (index < 98) return 'BLOCKED';
  return 'MAINTENANCE';
});
const shuffledStatuses = [...statusPool].sort(() => rng() - 0.5);

export function buildSeed(): FixtureState {
  const facilities: Facility[] = [];
  const floors: Floor[] = [];
  const zones: Zone[] = [];
  const spaces: ParkingSpace[] = [];
  const spaceByFacility: Record<string, ParkingSpace[]> = {};
  let spaceCursor = 0;

  facilityDefs.forEach((def) => {
    const facilityId = `fac_${def.key}`;
    const total = def.floors * def.zones * def.spacesPerZone;
    facilities.push({
      id: facilityId,
      slug: def.key,
      name: def.name,
      description: def.description,
      address: def.address,
      city: def.city,
      district: def.district,
      lat: def.lat,
      lng: def.lng,
      type: def.type,
      image: def.image,
      open24h: Boolean(def.open24h),
      openTime: '08:00',
      closeTime: '23:00',
      amenities: def.amenities,
      rules: [
        l(
          'Tezlik chegarasi 10 km/soat.',
          'Ограничение скорости 10 км/ч.',
          'Speed limit 10 km/h.',
        ),
        l(
          'Avtomobilni faqat belgilangan joyga qo‘ying.',
          'Паркуйтесь только на отведённом месте.',
          'Park only in the assigned space.',
        ),
        l(
          'Qimmatbaho buyumlarni ko‘rinadigan joyda qoldirmang.',
          'Не оставляйте ценные вещи на виду.',
          'Do not leave valuables in sight.',
        ),
      ],
      hourlyRate: def.hourlyRate,
      dailyCap: def.dailyCap,
      reservationFee: 2000,
      rating: def.rating,
      reviewCount: def.reviewCount,
      totalSpaces: total,
      phone: def.phone,
      status: 'ACTIVE',
    });

    spaceByFacility[facilityId] = [];

    for (let f = 0; f < def.floors; f += 1) {
      const floorId = `${facilityId}_f${f + 1}`;
      floors.push({
        id: floorId,
        facilityId,
        name: floorNames[f] ?? `P${f + 1}`,
        level: f + 1,
        totalSpaces: def.zones * def.spacesPerZone,
        status: 'ACTIVE',
      });

      for (let z = 0; z < def.zones; z += 1) {
        const zoneId = `${floorId}_z${z + 1}`;
        zones.push({
          id: zoneId,
          facilityId,
          floorId,
          name: zoneNames[z] ?? String.fromCharCode(65 + z),
          type: zoneTypes[z] ?? 'STANDARD',
          rateMultiplier: zoneMultipliers[z] ?? 1,
        });

        for (let i = 0; i < def.spacesPerZone; i += 1) {
          const status = shuffledStatuses[spaceCursor % shuffledStatuses.length];
          spaceCursor += 1;
          const code = `${floorNames[f]}-${zoneNames[z]}${String(i + 1).padStart(2, '0')}`;
          const space: ParkingSpace = {
            id: `${zoneId}_s${String(i + 1).padStart(2, '0')}`,
            code,
            facilityId,
            floorId,
            zoneId,
            x: 74 + i * 96,
            y: 52 + z * 148,
            w: 84,
            h: 92,
            status,
            type: zoneTypes[z] ?? 'STANDARD',
            sensor: status !== 'MAINTENANCE',
            updatedAt: new Date().toISOString(),
          };
          spaces.push(space);
          spaceByFacility[facilityId].push(space);
        }
      }
    }
  });

  const users: User[] = [
    {
      id: 'usr_demo',
      fullName: 'Dilshod Karimov',
      email: 'demo@parkovka.uz',
      phone: '+998 90 123 45 67',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2025-11-12T09:20:00.000Z',
    },
    {
      id: 'usr_guard',
      fullName: 'Bekzod Rahimov',
      email: 'guard@parkovka.uz',
      phone: '+998 91 234 56 78',
      role: 'GUARD',
      status: 'ACTIVE',
      facilityIds: ['fac_markaziy', 'fac_city'],
      createdAt: '2025-10-02T06:00:00.000Z',
    },
    {
      id: 'usr_admin',
      fullName: 'Nigora Abdullayeva',
      email: 'admin@parkovka.uz',
      phone: '+998 93 345 67 89',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2025-06-18T08:00:00.000Z',
    },
    ...(
      [
        ['usr_aziz', 'Aziz Tursunov', 'aziz.tursunov@example.com', '+998 90 210 11 22'],
        ['usr_kamola', 'Kamola Yusupova', 'kamola.yusupova@example.com', '+998 94 320 33 44'],
        ['usr_jasur', 'Jasur Bekmurodov', 'jasur.bekmurodov@example.com', '+998 97 430 55 66'],
        ['usr_malika', 'Malika Rahimova', 'malika.rahimova@example.com', '+998 99 540 77 88'],
        ['usr_sardor', 'Sardor Aliyev', 'sardor.aliyev@example.com', '+998 90 650 99 00'],
        ['usr_nilufar', 'Nilufar Karimova', 'nilufar.karimova@example.com', '+998 91 760 12 23'],
        ['usr_rustam', 'Rustam Qodirov', 'rustam.qodirov@example.com', '+998 93 870 34 45'],
        ['usr_zarina', 'Zarina Usmonova', 'zarina.usmonova@example.com', '+998 94 980 56 67'],
      ] as const
    ).map(([id, fullName, email, phone], index) => ({
      id,
      fullName,
      email,
      phone,
      role: 'USER' as const,
      status: index === 6 ? ('SUSPENDED' as const) : ('ACTIVE' as const),
      createdAt: dateAt(-60 - index * 6, 10, 15),
    })),
    {
      id: 'usr_guard2',
      fullName: 'Sanjar Qobulov',
      email: 'sanjar.qobulov@parkovka.uz',
      phone: '+998 90 111 22 33',
      role: 'GUARD',
      status: 'ACTIVE',
      facilityIds: ['fac_city', 'fac_airport'],
      createdAt: '2025-09-14T06:00:00.000Z',
    },
    {
      id: 'usr_guard3',
      fullName: 'Feruza Ismoilova',
      email: 'feruza.ismoilova@parkovka.uz',
      phone: '+998 91 222 33 44',
      role: 'GUARD',
      status: 'ACTIVE',
      facilityIds: ['fac_chilonzor'],
      createdAt: '2025-12-01T06:00:00.000Z',
    },
  ];

  const vehicles: Vehicle[] = [
    {
      id: 'veh_demo_1',
      userId: 'usr_demo',
      plate: '01 A 123 AB',
      make: 'Chevrolet',
      model: 'Malibu 2',
      color: 'Oq',
      year: 2022,
      isDefault: true,
    },
    {
      id: 'veh_demo_2',
      userId: 'usr_demo',
      plate: '01 B 456 CD',
      make: 'Kia',
      model: 'Sportage',
      color: 'Qora',
      year: 2021,
      isDefault: false,
    },
    { id: 'veh_aziz', userId: 'usr_aziz', plate: '01 C 777 AA', make: 'Toyota', model: 'Camry', color: 'Kulrang', year: 2020, isDefault: true },
    { id: 'veh_kamola', userId: 'usr_kamola', plate: '01 E 234 KK', make: 'Hyundai', model: 'Tucson', color: 'Ko‘k', year: 2023, isDefault: true },
    { id: 'veh_jasur', userId: 'usr_jasur', plate: '01 F 888 JJ', make: 'Chevrolet', model: 'Tracker', color: 'Qizil', year: 2022, isDefault: true },
    { id: 'veh_malika', userId: 'usr_malika', plate: '01 H 901 MM', make: 'Chery', model: 'Tiggo 7', color: 'Oq', year: 2023, isDefault: true },
    { id: 'veh_sardor', userId: 'usr_sardor', plate: '01 K 345 SS', make: 'BYD', model: 'Song Plus', color: 'Ko‘k', year: 2024, isDefault: true },
    { id: 'veh_nilufar', userId: 'usr_nilufar', plate: '01 M 678 NN', make: 'Kia', model: 'K5', color: 'Kulrang', year: 2021, isDefault: true },
    { id: 'veh_rustam', userId: 'usr_rustam', plate: '01 N 012 RR', make: 'Chevrolet', model: 'Cobalt', color: 'Oq', year: 2019, isDefault: true },
    { id: 'veh_zarina', userId: 'usr_zarina', plate: '01 P 345 ZZ', make: 'Volkswagen', model: 'Polo', color: 'Qora', year: 2020, isDefault: true },
  ];

  const driverUsers = users.filter((user) => user.role === 'USER' && user.status === 'ACTIVE');
  const vehiclesByUser = new Map(vehicles.map((vehicle) => [vehicle.userId, vehicle]));

  const reservations: Reservation[] = [];
  const payments: Payment[] = [];
  const sessions: ParkingSession[] = [];

  const statusForPast = (roll: number): ReservationStatus => {
    if (roll < 0.72) return 'COMPLETED';
    if (roll < 0.86) return 'CANCELLED';
    if (roll < 0.94) return 'EXPIRED';
    return 'NO_SHOW';
  };

  for (let i = 0; i < 46; i += 1) {
    const facility = pick(facilities);
    const facilitySpaces = spaceByFacility[facility.id];
    const space = pick(facilitySpaces);
    const user = i % 3 === 0 ? users[0] : pick(driverUsers);
    const vehicle = vehiclesByUser.get(user.id) ?? vehicles[0];
    const dayOffset = i < 6 ? randInt(0, 3) : -randInt(1, 29);
    const startHour = randInt(8, 20);
    const duration = randInt(1, 5);
    const startsAt = dateAt(dayOffset, startHour, pick([0, 15, 30, 45]));
    const endsAt = addHours(startsAt, duration);
    const now = Date.now();
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    const isFuture = startMs > now;
    const isOngoing = startMs <= now && endMs > now;
    const status: ReservationStatus = isFuture
      ? rng() < 0.86
        ? 'CONFIRMED'
        : 'CANCELLED'
      : isOngoing
        ? 'ACTIVE'
        : statusForPast(rng());
    const totalAmount = Math.round(
      Math.min(
        facility.dailyCap,
        (duration * facility.hourlyRate * (space.type === 'VIP' ? 1.5 : space.type === 'EV' ? 1.2 : 1)),
      ) + facility.reservationFee,
    );
    const paymentMethod = pick<PaymentMethod>(['PAYME', 'CLICK', 'UZCARD', 'HUMO', 'CASH']);
    const paid = status === 'CONFIRMED' || status === 'ACTIVE' || status === 'COMPLETED';
    const paymentStatus = status === 'CANCELLED' && paid ? 'REFUNDED' : paid ? 'PAID' : 'UNPAID';
    const reference = `RSV-${String(2100 + i)}`;
    const createdAt = addHours(startsAt, -randInt(1, 48));
    const reservation: Reservation = {
      id: `res_${i + 1}`,
      reference,
      userId: user.id,
      facilityId: facility.id,
      floorId: space.floorId,
      zoneId: space.zoneId,
      spaceId: space.id,
      spaceCode: space.code,
      startsAt,
      endsAt,
      status,
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate,
      totalAmount,
      paidAmount: paymentStatus === 'PAID' || paymentStatus === 'REFUNDED' ? totalAmount : 0,
      paymentStatus,
      qrToken: refToken(reference),
      createdAt,
    };
    reservations.push(reservation);

    if (paymentStatus !== 'UNPAID') {
      payments.push({
        id: `pay_r_${i + 1}`,
        reference: `PAY-${String(6100 + i)}`,
        userId: user.id,
        reservationId: reservation.id,
        facilityId: facility.id,
        amount: totalAmount,
        method: paymentMethod,
        status: paymentStatus === 'REFUNDED' ? 'REFUNDED' : 'PAID',
        createdAt,
        paidAt: createdAt,
      });
    }

    if (status === 'COMPLETED') {
      const amount = totalAmount - facility.reservationFee;
      sessions.push({
        id: `ses_r_${i + 1}`,
        reference: `SES-${String(4100 + i)}`,
        facilityId: facility.id,
        floorId: space.floorId,
        zoneId: space.zoneId,
        spaceId: space.id,
        spaceCode: space.code,
        userId: user.id,
        vehiclePlate: vehicle.plate,
        entryAt: startsAt,
        exitAt: endsAt,
        status: 'COMPLETED',
        amount,
        paid: true,
        reservationId: reservation.id,
        entryGuardId: 'usr_guard',
        exitGuardId: 'usr_guard',
      });
    }
  }

  const activeSessionDefinitions = [
    { facility: facilities[1], spaceIndex: 4, user: users[0], hoursAgo: 1.4, plate: '01 B 456 CD' },
    { facility: facilities[0], spaceIndex: 12, user: users[4], hoursAgo: 2.6, plate: '01 C 777 AA' },
    { facility: facilities[1], spaceIndex: 25, user: users[5], hoursAgo: 3.2, plate: '01 E 234 KK' },
    { facility: facilities[3], spaceIndex: 9, user: users[6], hoursAgo: 5.1, plate: '01 F 888 JJ' },
    { facility: facilities[2], spaceIndex: 17, user: users[7], hoursAgo: 0.7, plate: '01 H 901 MM' },
  ];

  activeSessionDefinitions.forEach((definition, index) => {
    const space = spaceByFacility[definition.facility.id][definition.spaceIndex];
    if (!space) return;
    space.status = 'OCCUPIED';
    space.updatedAt = new Date().toISOString();
    const entryAt = new Date(Date.now() - definition.hoursAgo * 36e5).toISOString();
    const amount = Math.round(
      definition.hoursAgo * definition.facility.hourlyRate +
        Math.max(0, Math.ceil(definition.hoursAgo) - 1) * 500,
    );
    sessions.push({
      id: `ses_active_${index + 1}`,
      reference: `SES-${String(5000 + index)}`,
      facilityId: definition.facility.id,
      floorId: space.floorId,
      zoneId: space.zoneId,
      spaceId: space.id,
      spaceCode: space.code,
      userId: definition.user.id,
      vehiclePlate: definition.plate,
      entryAt,
      status: 'ACTIVE',
      amount,
      paid: false,
      entryGuardId: 'usr_guard',
    });
  });

  // One active session linked to an upcoming demo reservation, for ticket coherence.
  const demoUpcomingStart = addHours(new Date().toISOString(), 2);
  const demoUpcomingSpace = spaceByFacility.fac_markaziy[3];
  demoUpcomingSpace.status = 'RESERVED';
  const demoReservation: Reservation = {
    id: 'res_demo_upcoming',
    reference: 'RSV-9081',
    userId: 'usr_demo',
    facilityId: 'fac_markaziy',
    floorId: demoUpcomingSpace.floorId,
    zoneId: demoUpcomingSpace.zoneId,
    spaceId: demoUpcomingSpace.id,
    spaceCode: demoUpcomingSpace.code,
    startsAt: demoUpcomingStart,
    endsAt: addHours(demoUpcomingStart, 3),
    status: 'CONFIRMED',
    vehicleId: 'veh_demo_1',
    vehiclePlate: '01 A 123 AB',
    totalAmount: 20000,
    paidAmount: 20000,
    paymentStatus: 'PAID',
    qrToken: refToken('RSV-9081'),
    createdAt: new Date(Date.now() - 36e5).toISOString(),
  };
  reservations.unshift(demoReservation);
  payments.unshift({
    id: 'pay_demo_upcoming',
    reference: 'PAY-9901',
    userId: 'usr_demo',
    reservationId: demoReservation.id,
    facilityId: 'fac_markaziy',
    amount: 20000,
    method: 'PAYME',
    status: 'PAID',
    createdAt: new Date(Date.now() - 36e5).toISOString(),
    paidAt: new Date(Date.now() - 36e5).toISOString(),
  });

  // Guarantee a few of today's payments so the dashboard has meaningful data.
  for (let i = 0; i < 6; i += 1) {
    const facility = facilities[i % facilities.length];
    const method = (['PAYME', 'CLICK', 'UZCARD', 'HUMO', 'CASH'] as PaymentMethod[])[i % 5];
    const amount = 8000 + i * 4500;
    const paidAt = new Date();
    paidAt.setHours(Math.max(8, paidAt.getHours() - i), 10 * i, 0, 0);
    payments.push({
      id: `pay_today_${i + 1}`,
      reference: `PAY-${String(9200 + i)}`,
      userId: driverUsers[(i + 2) % driverUsers.length].id,
      facilityId: facility.id,
      amount,
      method,
      status: 'PAID',
      createdAt: paidAt.toISOString(),
      paidAt: paidAt.toISOString(),
    });
  }

  const reviews: Review[] = [
    {
      id: 'rev_1',
      facilityId: 'fac_markaziy',
      userId: 'usr_aziz',
      userName: 'Aziz Tursunov',
      rating: 5,
      comment:
        'Markazda ishlash uchun eng qulay parking. Ertalab kelganda ham joy topiladi, xodimlar xushmuomala.',
      createdAt: dateAt(-3, 18, 20),
    },
    {
      id: 'rev_2',
      facilityId: 'fac_markaziy',
      userId: 'usr_kamola',
      userName: 'Kamola Yusupova',
      rating: 4,
      comment: 'QR bilan kirish juda tez. Lift toza, yoritish yaxshi. Narxi biroz yuqori.',
      createdAt: dateAt(-8, 12, 5),
    },
    {
      id: 'rev_3',
      facilityId: 'fac_city',
      userId: 'usr_jasur',
      userName: 'Jasur Bekmurodov',
      rating: 5,
      comment: 'Toshkent City uchun ideal. Savdo markaziga to‘g‘ridan-to‘g‘ri lift bor.',
      createdAt: dateAt(-2, 21, 40),
    },
    {
      id: 'rev_4',
      facilityId: 'fac_city',
      userId: 'usr_malika',
      userName: 'Malika Rahimova',
      rating: 4,
      comment: 'Dam olish kunlari biroz band, lekin onlayn bron qilsa muammo yo‘q.',
      createdAt: dateAt(-5, 16, 10),
    },
    {
      id: 'rev_5',
      facilityId: 'fac_chilonzor',
      userId: 'usr_sardor',
      userName: 'Sardor Aliyev',
      rating: 4,
      comment: 'Oila bilan xaridga borganda qulay. Narx ham munosib.',
      createdAt: dateAt(-6, 14, 30),
    },
    {
      id: 'rev_6',
      facilityId: 'fac_airport',
      userId: 'usr_nilufar',
      userName: 'Nilufar Karimova',
      rating: 5,
      comment: 'Uchib ketishdan oldin 4 kun qoldirdim. Mashina xavfsiz, transfer tez ishladi.',
      createdAt: dateAt(-12, 7, 45),
    },
    {
      id: 'rev_7',
      facilityId: 'fac_registon',
      userId: 'usr_rustam',
      userName: 'Rustam Qodirov',
      rating: 5,
      comment: 'Registonga piyoda 5 daqiqa. Sayyohlar uchun juda qulay.',
      createdAt: dateAt(-9, 11, 15),
    },
    {
      id: 'rev_8',
      facilityId: 'fac_ark',
      userId: 'usr_zarina',
      userName: 'Zarina Usmonova',
      rating: 4,
      comment: 'Buxoroning eski shahar qismida joy topish qiyin, bu parking katta yordam berdi.',
      createdAt: dateAt(-14, 19, 0),
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'ntf_1',
      userId: 'usr_demo',
      title: l('Bron tasdiqlandi', 'Бронь подтверждена', 'Reservation confirmed'),
      body: l(
        'Markaziy Park, P1-A04 joyi 3 soatga band qilindi.',
        'Центральный парк, место P1-A04 забронировано на 3 часа.',
        'Central Park, space P1-A04 booked for 3 hours.',
      ),
      kind: 'RESERVATION',
      read: false,
      createdAt: dateAt(0, 9, 12),
      href: '/app/tickets',
    },
    {
      id: 'ntf_2',
      userId: 'usr_demo',
      title: l('To‘lov qabul qilindi', 'Платёж получен', 'Payment received'),
      body: l(
        '20 000 so‘m Payme orqali to‘landi.',
        'Оплачено 20 000 сум через Payme.',
        '20,000 UZS paid via Payme.',
      ),
      kind: 'PAYMENT',
      read: false,
      createdAt: dateAt(0, 9, 13),
      href: '/app/payments',
    },
    {
      id: 'ntf_3',
      userId: 'usr_demo',
      title: l('Kirish qayd etildi', 'Въезд зафиксирован', 'Entry recorded'),
      body: l(
        'Toshkent City, P1-B05. Sessiya faol.',
        'Ташкент Сити, P1-B05. Сессия активна.',
        'Tashkent City, P1-B05. Session active.',
      ),
      kind: 'ENTRY',
      read: true,
      createdAt: dateAt(0, 8, 20),
      href: '/app/active',
    },
    {
      id: 'ntf_4',
      userId: 'usr_demo',
      title: l('Yaqinlashayotgan bron', 'Скоро бронь', 'Upcoming reservation'),
      body: l(
        'Markaziy Park broningiz 2 soatdan so‘ng boshlanadi.',
        'Ваша бронь в Центральном парке начнётся через 2 часа.',
        'Your Central Park reservation starts in 2 hours.',
      ),
      kind: 'RESERVATION',
      read: true,
      createdAt: dateAt(-1, 18, 0),
      href: '/app/reservations',
    },
    {
      id: 'ntf_5',
      role: 'GUARD',
      title: l('Kunlik hisobot', 'Ежедневный отчёт', 'Daily report'),
      body: l(
        'Smenada 34 kirish va 29 chiqish qayd etildi.',
        'За смену зафиксировано 34 въезда и 29 выездов.',
        '34 entries and 29 exits recorded this shift.',
      ),
      kind: 'SYSTEM',
      read: false,
      createdAt: dateAt(0, 7, 0),
      href: '/guard/activity',
    },
    {
      id: 'ntf_6',
      role: 'GUARD',
      title: l('Kamera holati', 'Статус камеры', 'Camera status'),
      body: l(
        'Chilonzor Plaza kirish kamerasida aloqa uzildi.',
        'Потеряна связь с камерой въезда Chilonzor Plaza.',
        'Connection lost with the Chilonzor Plaza entry camera.',
      ),
      kind: 'INCIDENT',
      read: false,
      createdAt: dateAt(0, 6, 40),
      href: '/guard/incidents',
    },
    {
      id: 'ntf_7',
      role: 'ADMIN',
      title: l('Yangi foydalanuvchi', 'Новый пользователь', 'New user'),
      body: l(
        'Zarina Usmonova ro‘yxatdan o‘tdi.',
        'Зарегистрировалась Зарина Усманова.',
        'Zarina Usmonova signed up.',
      ),
      kind: 'SYSTEM',
      read: false,
      createdAt: dateAt(0, 10, 5),
      href: '/admin/users',
    },
    {
      id: 'ntf_8',
      role: 'ADMIN',
      title: l('Ochiq hodisa', 'Открытый инцидент', 'Open incident'),
      body: l(
        'Toshkent City P2 zonasida to‘siq buzilgani qayd etildi.',
        'В зоне P2 Tashkent City зафиксировано повреждение шлагбаума.',
        'A damaged barrier was reported in Tashkent City zone P2.',
      ),
      kind: 'INCIDENT',
      read: false,
      createdAt: dateAt(-1, 16, 25),
      href: '/admin/reports',
    },
  ];

  const cameras: Camera[] = [];
  facilities.forEach((facility, facilityIndex) => {
    const floor = floors.find((item) => item.facilityId === facility.id);
    const zone = zones.find((item) => item.floorId === floor?.id);
    cameras.push(
      {
        id: `cam_${facilityIndex}_entry`,
        facilityId: facility.id,
        name: `${facility.name.uz} — kirish`,
        type: 'ENTRY',
        status: facilityIndex === 2 ? 'DEGRADED' : 'ONLINE',
        lastSeen: new Date(Date.now() - (facilityIndex === 2 ? 45 : 1) * 60000).toISOString(),
        resolution: '1080p',
      },
      {
        id: `cam_${facilityIndex}_exit`,
        facilityId: facility.id,
        name: `${facility.name.uz} — chiqish`,
        type: 'EXIT',
        status: 'ONLINE',
        lastSeen: new Date(Date.now() - 2 * 60000).toISOString(),
        resolution: '1080p',
      },
      {
        id: `cam_${facilityIndex}_zone`,
        facilityId: facility.id,
        name: `${facility.name.uz} — ${zone?.name ?? 'A'} zona`,
        type: 'SPACE',
        zoneId: zone?.id,
        status: facilityIndex === 4 ? 'OFFLINE' : 'ONLINE',
        lastSeen: new Date(Date.now() - (facilityIndex === 4 ? 72 * 3600 : 3) * 1000).toISOString(),
        resolution: '4K',
      },
    );
  });

  const incidents: Incident[] = [
    {
      id: 'inc_1',
      facilityId: 'fac_city',
      type: 'EQUIPMENT',
      severity: 'HIGH',
      description: 'P2 qavatdagi kirish to‘sig‘i ochilmayapti.',
      reportedBy: 'Bekzod Rahimov',
      createdAt: dateAt(-1, 16, 25),
      status: 'OPEN',
    },
    {
      id: 'inc_2',
      facilityId: 'fac_chilonzor',
      type: 'BLOCKING',
      severity: 'MEDIUM',
      description: 'B-12 joyida ruxsatsiz to‘xtash qayd etildi.',
      plate: '01 X 456 XX',
      reportedBy: 'Feruza Ismoilova',
      createdAt: dateAt(-2, 13, 10),
      status: 'RESOLVED',
    },
    {
      id: 'inc_3',
      facilityId: 'fac_markaziy',
      type: 'DAMAGE',
      severity: 'LOW',
      description: 'P1 devoridagi yo‘l belgisi shikastlangan.',
      reportedBy: 'Bekzod Rahimov',
      createdAt: dateAt(-6, 10, 5),
      status: 'RESOLVED',
    },
    {
      id: 'inc_4',
      facilityId: 'fac_airport',
      type: 'THEFT',
      severity: 'HIGH',
      description: 'Mijoz mashinasidan kichik sumka yo‘qolgani haqida shikoyat qildi.',
      plate: '01 D 654 AA',
      reportedBy: 'Sanjar Qobulov',
      createdAt: dateAt(-4, 20, 45),
      status: 'OPEN',
    },
  ];

  const auditActions: [string, string, string][] = [
    ['created reservation', 'reservation', 'RSV-9081'],
    ['confirmed payment', 'payment', 'PAY-9901'],
    ['blocked space', 'space', 'P2-C09'],
    ['updated tariff', 'pricing', 'Markaziy Park'],
    ['activated user', 'user', 'LeGeND'],
    ['recorded vehicle entry', 'session', 'SES-5000'],
    ['recorded vehicle exit', 'session', 'SES-4102'],
    ['reported incident', 'incident', 'INC-0001'],
    ['added camera', 'camera', 'Toshkent City — kirish'],
    ['changed facility hours', 'facility', 'Chilonzor Plaza'],
    ['suspended user', 'user', 'LeGeND'],
    ['exported report', 'report', 'Revenue 30 days'],
  ];
  const actorPool: [string, User['role']][] = [
    ['LeGeND', 'ADMIN'],
    ['Mirfozil', 'GUARD'],
    ['Khan', 'GUARD'],
    ['Ilhom', 'USER'],
  ];
  const auditLogs: AuditLog[] = Array.from({ length: 24 }, (_, index) => {
    const [action, entity, entityId] = auditActions[index % auditActions.length];
    const [actor, actorRole] = actorPool[index % actorPool.length];
    return {
      id: `aud_${index + 1}`,
      actor,
      actorRole,
      action,
      entity,
      entityId,
      at: dateAt(-Math.floor(index / 3), 8 + (index % 12), (index * 7) % 60),
      ip: `10.0.${index % 8}.${20 + index}`,
    };
  });

  const pricingRules: PricingRule[] = facilities.flatMap((facility) => [
    {
      id: `pr_${facility.id}_hourly`,
      facilityId: facility.id,
      name: l('Standart soatlik', 'Стандартный почасовой', 'Standard hourly'),
      type: 'HOURLY' as const,
      rate: facility.hourlyRate,
      active: true,
    },
    {
      id: `pr_${facility.id}_night`,
      facilityId: facility.id,
      name: l('Tungi tarif', 'Ночной тариф', 'Night rate'),
      type: 'NIGHT' as const,
      rate: Math.round(facility.hourlyRate * 0.7),
      startTime: '22:00',
      endTime: '06:00',
      active: facility.type !== 'AIRPORT',
    },
  ]);

  return {
    facilities,
    floors,
    zones,
    spaces,
    users,
    vehicles,
    reservations,
    sessions,
    payments,
    reviews,
    notifications,
    cameras,
    incidents,
    auditLogs,
    pricingRules,
    settings: {
      companyName: 'Parkovka MChJ',
      supportPhone: '+998 71 200 00 00',
      supportEmail: 'info@parkovka.uz',
      defaultLanguage: 'uz',
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
      maintenanceWindow: '02:00 – 04:00',
      paymentProvider: 'Payme · Click · Uzcard · Humo',
      cameraProvider: 'ParkVision AI',
    },
    passwords: Object.fromEntries(users.map((user) => [user.email, 'parkovka'])),
  };
}
