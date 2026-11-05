import { FileText, Lock, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/use-page-title';
import type { Language } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

type LegalKind = 'privacy' | 'terms';

interface LegalSection {
  title: Record<Language, string>;
  body: Record<Language, string>;
}

const DOCS: Record<LegalKind, { title: Record<Language, string>; updated: string; sections: LegalSection[] }> = {
  privacy: {
    title: { uz: 'Maxfiylik siyosati', ru: 'Политика конфиденциальности', en: 'Privacy policy' },
    updated: '2026-01-15',
    sections: [
      {
        title: { uz: 'Qanday ma’lumot yig‘amiz', ru: 'Какие данные мы собираем', en: 'What data we collect' },
        body: {
          uz: 'Hisob yaratishda ism, email va telefon raqamingizni qabul qilamiz. Bron qilishda avtomobil raqami va parking sessiyasi ma’lumotlari saqlanadi. To‘lov kartasi ma’lumotlari bizning serverimizda saqlanmaydi — ular to‘lov provayderi tomonidan xavfsiz qayta ishlanadi.',
          ru: 'При регистрации мы получаем имя, email и номер телефона. При бронировании сохраняются номер автомобиля и данные парковочной сессии. Данные банковской карты не хранятся на наших серверах — их безопасно обрабатывает платёжный провайдер.',
          en: 'When you create an account we receive your name, email and phone number. Booking storage includes your vehicle plate and parking session data. Card details are never stored on our servers — they are processed securely by the payment provider.',
        },
      },
      {
        title: { uz: 'Ma’lumotlardan foydalanish', ru: 'Как мы используем данные', en: 'How we use data' },
        body: {
          uz: 'Ma’lumotlar bronni tasdiqlash, kirish-chiqishni qayd etish, to‘lovlarni amalga oshirish va qo‘llab-quvvatlash uchun ishlatiladi. Statistik hisobotlar shaxsni aniqlamaydigan jamlangan ko‘rinishda tayyorlanadi.',
          ru: 'Данные используются для подтверждения брони, фиксации въезда и выезда, проведения платежей и поддержки. Статистические отчёты формируются в обезличенном агрегированном виде.',
          en: 'Data is used to confirm bookings, record entry and exit, process payments and provide support. Analytics reports are aggregated and do not identify individuals.',
        },
      },
      {
        title: { uz: 'Saqlash va xavfsizlik', ru: 'Хранение и безопасность', en: 'Retention and security' },
        body: {
          uz: 'Sessiya ma’lumotlari buxgalteriya va xavfsizlik talablariga muvofiq saqlanadi. Kirish huquqlari rolga asoslanadi: haydovchi faqat o‘z ma’lumotlarini, qo‘riqchi smena doirasidagi ma’lumotlarni ko‘radi.',
          ru: 'Данные сессий хранятся в соответствии с бухгалтерскими требованиями и требованиями безопасности. Доступ основан на ролях: водитель видит только свои данные, охранник — данные в рамках смены.',
          en: 'Session data is retained to meet accounting and security requirements. Access is role-based: drivers see only their own records, guards see records within their shift scope.',
        },
      },
      {
        title: { uz: 'Sizning huquqlaringiz', ru: 'Ваши права', en: 'Your rights' },
        body: {
          uz: 'Profilingizdagi ma’lumotlarni istalgan vaqtda ko‘rishingiz va yangilashingiz mumkin. Ma’lumotlarni o‘chirish yoki eksport qilish bo‘yicha so‘rovni hello@parkovka.uz manziliga yuboring.',
          ru: 'Вы можете просматривать и обновлять данные профиля в любое время. Запросы на удаление или экспорт данных отправляйте на hello@parkovka.uz.',
          en: 'You can view and update your profile data at any time. Send deletion or export requests to hello@parkovka.uz.',
        },
      },
    ],
  },
  terms: {
    title: { uz: 'Foydalanish shartlari', ru: 'Условия использования', en: 'Terms of service' },
    updated: '2026-01-15',
    sections: [
      {
        title: { uz: 'Xizmatdan foydalanish', ru: 'Использование сервиса', en: 'Using the service' },
        body: {
          uz: 'Parkovka parking joylarini oldindan band qilish va to‘lovlarni boshqarish xizmatini taqdim etadi. Xizmatdan foydalanish uchun aniq va haqiqiy ma’lumot kiritishingiz shart. Boshqa shaxs nomidan bron qilish taqiqlanadi.',
          ru: 'Parkovka предоставляет сервис предварительного бронирования парковочных мест и управления платежами. Для использования сервиса необходимо указывать достоверные данные. Бронирование от имени другого лица запрещено.',
          en: 'Parkovka provides a service for reserving parking spaces in advance and managing payments. You must provide accurate information to use the service. Booking on behalf of another person is not permitted.',
        },
      },
      {
        title: { uz: 'Bron va bekor qilish', ru: 'Бронирование и отмена', en: 'Bookings and cancellation' },
        body: {
          uz: 'Bron tasdiqlangach joy belgilangan vaqt oralig‘ida siz uchun saqlanadi. Bekor qilish bron boshlanishidan oldin «Bronlarim» bo‘limida amalga oshiriladi. Bron boshlanganidan keyin to‘lov qaytarilmaydi.',
          ru: 'После подтверждения место сохраняется за вами на указанный интервал. Отмена выполняется в разделе «Мои брони» до начала брони. После начала брони возврат средств не производится.',
          en: 'Once confirmed, the space is held for your time window. Cancellation is available in “My reservations” before the booking starts. No refund is issued after the booking start time.',
        },
      },
      {
        title: { uz: 'To‘lovlar', ru: 'Платежи', en: 'Payments' },
        body: {
          uz: 'Onlayn to‘lovlar Payme, Click, Uzcard va Humo orqali amalga oshiriladi. Parkingda to‘lash ham mumkin. Yakuniy summa amaldagi tarif va parkda o‘tkazilgan vaqtga qarab hisoblanadi.',
          ru: 'Онлайн-платежи проходят через Payme, Click, Uzcard и Humo. Также возможна оплата на парковке. Итоговая сумма рассчитывается по действующему тарифу и фактическому времени стоянки.',
          en: 'Online payments are processed via Payme, Click, Uzcard and Humo. Payment on site is also possible. The final amount is based on the applicable rate and actual parking duration.',
        },
      },
      {
        title: { uz: 'Javobgarlik', ru: 'Ответственность', en: 'Liability' },
        body: {
          uz: 'Parkovka joyning mavjudligi va tizimning uzluksiz ishlashi uchun oqilona choralar ko‘radi. Avtomobil ichidagi shaxsiy buyumlar uchun javobgarlik haydovchida qoladi. Favqulodda holatlarda qo‘riqchi xizmatiga murojaat qiling.',
          ru: 'Parkovka принимает разумные меры для обеспечения доступности мест и стабильной работы системы. Ответственность за личные вещи в автомобиле остаётся за водителем. В экстренных случаях обращайтесь к охране.',
          en: 'Parkovka takes reasonable measures to keep spaces available and the system reliable. Responsibility for personal belongings inside the vehicle remains with the driver. Contact on-site security in emergencies.',
        },
      },
    ],
  },
};

export function LegalPage() {
  const { kind } = useParams();
  const { language, t } = useI18n();
  const doc = kind === 'privacy' || kind === 'terms' ? DOCS[kind] : null;
  usePageTitle(doc ? doc.title[language] : t('common.notFound'));

  if (!doc) return <Navigate to="/" replace />;

  return (
    <div className="page-container py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          {kind === 'privacy' ? <Lock className="size-4" /> : <FileText className="size-4" />}
          Parkovka
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {doc.title[language]}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {language === 'uz' ? 'Yangilangan sana' : language === 'ru' ? 'Обновлено' : 'Last updated'}:{' '}
          {doc.updated}
        </p>

        <div className="mt-8 space-y-6">
          {doc.sections.map((section, index) => (
            <section key={index} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h2 className="flex items-start gap-2.5 font-display text-base font-semibold text-foreground">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-navy-900 text-[11px] text-gold-400 dark:bg-gold-500 dark:text-navy-950">
                  {index + 1}
                </span>
                {section.title[language]}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{section.body[language]}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-5">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            {language === 'uz'
              ? 'Savollaringiz bormi? Biz yordam berishga tayyormiz.'
              : language === 'ru'
                ? 'Есть вопросы? Мы готовы помочь.'
                : 'Questions? We are here to help.'}
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={kind === 'privacy' ? '/legal/terms' : '/legal/privacy'}>
                {kind === 'privacy' ? t('footer.terms') : t('footer.privacy')}
              </Link>
            </Button>
            <Button asChild size="sm">
              <a href="mailto:hello@parkovka.uz">{t('footer.contact')}</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
