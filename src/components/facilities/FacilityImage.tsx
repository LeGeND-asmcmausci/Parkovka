import { SquareParking } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function FacilityImage({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn('relative overflow-hidden bg-navy-900', className)}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn('size-full object-cover', imgClassName)}
        />
      ) : (
        <div className="grid-lines flex size-full items-center justify-center bg-[radial-gradient(120%_120%_at_20%_0%,#163b66_0%,#0b1b33_55%,#070f1f_100%)]">
          <SquareParking className="size-12 text-gold-500/70" strokeWidth={1.4} />
        </div>
      )}
    </div>
  );
}
