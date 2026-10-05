import { motion } from 'motion/react';
import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn, haptic } from '@/lib/utils';

type Variant = 'primary' | 'soft' | 'ghost' | 'glass' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink shadow-[0_10px_30px_-10px_var(--accent)] hover:brightness-105 hover:shadow-[0_14px_36px_-10px_var(--accent)]',
  soft: 'bg-accent-soft text-ink hover:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]',
  ghost: 'text-ink hover:bg-line',
  glass: 'glass text-ink hover:bg-surface-strong',
  danger: 'bg-[color-mix(in_oklab,var(--color-bad)_14%,transparent)] text-bad hover:bg-[color-mix(in_oklab,var(--color-bad)_22%,transparent)]',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'soft', size = 'md', icon, className, children, onClick, ...rest },
  ref,
) {
  const sizes = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-xl', md: 'h-10 px-4 text-sm gap-2 rounded-2xl', lg: 'h-12 px-5 text-base gap-2 rounded-2xl' };
  return (
    <button
      ref={ref}
      className={cn('pressable inline-flex shrink-0 items-center justify-center font-extrabold whitespace-nowrap select-none disabled:opacity-50', sizes[size], variants[variant], className)}
      onClick={(e) => {
        haptic(6);
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Variant;
  size?: number;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  { label, variant = 'ghost', size = 40, className, children, active, onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'pressable inline-grid shrink-0 place-items-center rounded-2xl disabled:opacity-40',
        variants[variant],
        active && 'bg-accent-soft text-accent',
        className,
      )}
      style={{ width: size, height: size }}
      onClick={(e) => {
        haptic(6);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic(8);
        onChange(!checked);
      }}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-40', checked ? 'bg-accent' : 'bg-line')}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 32 }}
        className={cn('absolute top-1 size-5 rounded-full bg-white shadow-md', checked ? 'right-1' : 'left-1')}
      />
    </button>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={label}
      className={cn('floww-range', className)}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--p' as string]: `${pct}%` }}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn('inline-flex rounded-2xl bg-line p-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => {
              haptic(6);
              onChange(o.value);
            }}
            className={cn(
              'relative flex-1 rounded-xl font-extrabold whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
              on ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-surface-strong shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-md border border-line bg-surface-strong px-1.5 font-sans text-[11px] font-extrabold text-muted shadow-[0_1px_0_var(--line)]">{children}</kbd>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-3xl bg-surface-strong/70 p-4 ring-1 ring-line', className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-black tracking-wide text-muted uppercase">{children}</h3>
      {right}
    </div>
  );
}

export function Empty({ emoji, title, body, children }: { emoji: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-10 text-center">
      <motion.div className="text-5xl" animate={{ y: [0, -6, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 3, repeat: Infinity }}>
        {emoji}
      </motion.div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="max-w-[260px] text-sm text-muted">{body}</p>}
      {children}
    </div>
  );
}
