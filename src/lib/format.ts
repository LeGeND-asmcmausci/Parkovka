import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';
import { enUS, ru, uz } from 'date-fns/locale';
import type { Language } from '@/lib/types';

const dateLocales = { uz, ru, en: enUS };
const intlLocales: Record<Language, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

export function formatAmount(amount: number, language: Language) {
  const formatted = new Intl.NumberFormat(intlLocales[language], {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  if (language === 'uz') return `${formatted} so‘m`;
  if (language === 'ru') return `${formatted} сум`;
  return `${formatted} UZS`;
}

export function formatCompactAmount(amount: number, language: Language) {
  if (amount >= 1_000_000) {
    const value = new Intl.NumberFormat(intlLocales[language], {
      maximumFractionDigits: 1,
    }).format(amount / 1_000_000);
    return language === 'en' ? `${value}M UZS` : `${value} mln so‘m`;
  }
  if (amount >= 1_000) {
    const value = new Intl.NumberFormat(intlLocales[language], {
      maximumFractionDigits: 0,
    }).format(amount / 1_000);
    return language === 'en' ? `${value}K UZS` : `${value} ming so‘m`;
  }
  return formatAmount(amount, language);
}

export function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(intlLocales[language]).format(value);
}

export function formatDate(value: string | Date, language: Language, pattern = 'd MMM yyyy') {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, pattern, { locale: dateLocales[language] });
}

export function formatTime(value: string | Date, language: Language) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, 'HH:mm', { locale: dateLocales[language] });
}

export function formatDateTime(value: string | Date, language: Language) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, 'd MMM, HH:mm', { locale: dateLocales[language] });
}

export function formatFullDateTime(value: string | Date, language: Language) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, 'd MMMM yyyy, HH:mm', { locale: dateLocales[language] });
}

export function formatDayLabel(value: string | Date, language: Language) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isToday(date)) return language === 'uz' ? 'Bugun' : language === 'ru' ? 'Сегодня' : 'Today';
  if (isTomorrow(date)) return language === 'uz' ? 'Ertaga' : language === 'ru' ? 'Завтра' : 'Tomorrow';
  if (isYesterday(date))
    return language === 'uz' ? 'Kecha' : language === 'ru' ? 'Вчера' : 'Yesterday';
  return formatDate(date, language);
}

export function formatRelative(value: string | Date, language: Language) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: dateLocales[language],
  });
}

export function formatDuration(hours: number, language: Language) {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return language === 'uz'
      ? `${minutes} daqiqa`
      : language === 'ru'
        ? `${minutes} мин`
        : `${minutes} min`;
  }
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  const hourLabel =
    language === 'uz' ? 'soat' : language === 'ru' ? 'ч' : whole === 1 ? 'hour' : 'hours';
  const minuteLabel = language === 'uz' ? 'daqiqa' : language === 'ru' ? 'мин' : 'min';
  return minutes > 0 ? `${whole} ${hourLabel} ${minutes} ${minuteLabel}` : `${whole} ${hourLabel}`;
}

export function formatPercent(value: number, language: Language) {
  return `${new Intl.NumberFormat(intlLocales[language], {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function formatPlate(plate: string) {
  return plate.toUpperCase().replace(/\s+/g, ' ').trim();
}
