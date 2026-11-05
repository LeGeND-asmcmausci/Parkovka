import { Check, Copy, Download, Printer, QrCode, SquareParking } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { formatAmount, formatFullDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Facility, Reservation } from '@/lib/types';
import { downloadTextFile } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

export function TicketCard({
  reservation,
  facility,
  showActions = true,
}: {
  reservation: Reservation;
  facility?: Facility;
  showActions?: boolean;
}) {
  const { t, tx, language } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reservation.qrToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const lines = [
      'PARKOVKA — QR CHIPTA',
      '====================',
      `${t('booking.ticketNumber')}: ${reservation.reference}`,
      `${t('qr.facility')}: ${facility ? tx(facility.name) : reservation.facilityId}`,
      `${t('qr.space')}: ${reservation.spaceCode}`,
      `${t('booking.startAt')}: ${formatFullDateTime(reservation.startsAt, language)}`,
      `${t('booking.endAt')}: ${formatFullDateTime(reservation.endsAt, language)}`,
      `${t('booking.vehicle')}: ${reservation.vehiclePlate}`,
      `${t('booking.total')}: ${formatAmount(reservation.totalAmount, language)}`,
      `${t('qr.reference')}: ${reservation.qrToken}`,
      '',
      'Kirishda ushbu QR kodni qo‘riqchiga ko‘rsating.',
    ];
    downloadTextFile(`${reservation.reference}.txt`, lines.join('\n'));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="relative overflow-hidden bg-navy-950 px-5 py-5 text-white">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
              <SquareParking className="size-4 text-gold-400" /> Parkovka
            </p>
            <p className="mt-2 font-display text-xl font-bold tracking-tight">{reservation.reference}</p>
            <p className="mt-0.5 text-[11px] text-white/50">{t('qr.subtitle')}</p>
          </div>
          <StatusBadge status={reservation.status} className="border-white/15 bg-white/10 text-white" />
        </div>
      </div>

      <div className="relative px-5 py-6">
        <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3 shadow-sm">
          <QRCodeSVG
            value={reservation.qrToken}
            size={184}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#0b1b33"
            aria-label={`${t('qr.title')} ${reservation.qrToken}`}
          />
        </div>
        <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {t('qr.showThisCode')}
        </p>
        <button
          type="button"
          onClick={() => void copy()}
          className="mx-auto mt-2 flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-foreground transition-colors hover:bg-muted"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          {reservation.qrToken}
        </button>

        <div className="my-5 border-t border-dashed border-border" />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('qr.facility')}</dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {facility ? tx(facility.name) : reservation.facilityId}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('qr.space')}</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{reservation.spaceCode}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('booking.vehicle')}</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{reservation.vehiclePlate}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('booking.startAt')}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{formatFullDateTime(reservation.startsAt, language)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('booking.endAt')}</dt>
            <dd className="mt-0.5 font-medium text-foreground">{formatFullDateTime(reservation.endsAt, language)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('booking.total')}</dt>
            <dd className="mt-0.5 font-semibold text-foreground">{formatAmount(reservation.totalAmount, language)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('guard.paymentStatus')}</dt>
            <dd className="mt-1">
              <StatusBadge status={reservation.paymentStatus} />
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-center gap-1 overflow-hidden opacity-30" aria-hidden>
          {Array.from({ length: 42 }, (_, index) => (
            <span
              key={index}
              className="h-6 bg-navy-950"
              style={{ width: index % 3 === 0 ? 3 : index % 5 === 0 ? 1 : 2 }}
            />
          ))}
        </div>

        {showActions && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={download} leftIcon={<Download />}>
              {t('booking.downloadTicket')}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => window.print()} leftIcon={<Printer />}>
              {t('qr.print')}
            </Button>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <QrCode className="size-3" />
          {t('qr.manualHint')}
        </p>
      </div>
    </div>
  );
}
