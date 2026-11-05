import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuSeparator = ({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) => (
  <DropdownPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
);

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-pop data-[state=open]:animate-[rise_0.18s_ease-out]',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
});

interface ItemProps extends ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> {
  icon?: ReactNode;
  danger?: boolean;
  selected?: boolean;
}

export const DropdownMenuItem = forwardRef<ElementRef<typeof DropdownPrimitive.Item>, ItemProps>(
  function DropdownMenuItem({ className, icon, danger, selected, children, ...props }, ref) {
    return (
      <DropdownPrimitive.Item
        ref={ref}
        className={cn(
          'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
          danger ? 'text-destructive focus:bg-destructive/10' : 'text-foreground',
          className,
        )}
        {...props}
      >
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="flex-1 truncate">{children}</span>
        {selected && <Check className="text-accent" />}
      </DropdownPrimitive.Item>
    );
  },
);

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Label
      ref={ref}
      className={cn('px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', className)}
      {...props}
    />
  );
});
