import {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from 'react';
import type { LucideIcon } from 'lucide-react';

function cx(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(' ');
}

const BRAND_GRADIENT = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)';
const BRAND_SHADOW = '0 0 0 1px rgba(37,99,235,0.15), 0 4px 20px -4px rgba(37,99,235,0.35)';

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cx(
        'bg-white rounded-2xl border border-slate-200/80',
        hover && 'transition duration-200 hover:-translate-y-0.5 cursor-default',
        className,
      )}
      style={{ boxShadow: '0 2px 8px -2px rgba(15,23,42,0.08), 0 1px 4px -2px rgba(15,23,42,0.06)' }}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
  icon: Icon,
  iconColor,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className="mt-0.5 grid place-items-center w-10 h-10 rounded-xl text-white shrink-0"
            style={{ background: iconColor ?? BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            <Icon size={20} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  style: styleProp,
  ...props
}: BtnProps) {
  const isPrimary = variant === 'primary';
  const baseClass =
    'inline-flex items-center justify-center rounded-lg font-semibold transition disabled:opacity-50 disabled:pointer-events-none';
  const variantClass = {
    primary: 'text-white hover:brightness-110 active:brightness-95',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  }[variant];
  const sizing = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
  }[size];

  return (
    <button
      className={cx(baseClass, variantClass, sizing, className)}
      style={
        isPrimary
          ? { background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW, ...styleProp }
          : styleProp
      }
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', style, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800',
        'shadow-sm transition placeholder:text-slate-400',
        'focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10',
        className,
      )}
      style={style}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800',
        'shadow-sm transition appearance-none pr-8',
        'focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800',
        'shadow-sm transition placeholder:text-slate-400',
        'focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const STATE_COLORS: Record<string, { dot: string; chip: string }> = {
  ONLINE: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  BUSY: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  OFFLINE: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  QUEUED: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  DISPATCHED: { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  RUNNING: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  FINISHED: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  FAILED: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 ring-red-600/20' },
  CANCELLED: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  TIMEOUT: { dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
};

const LIVE_STATES = ['ONLINE', 'BUSY', 'RUNNING', 'DISPATCHED'];

export function StatusBadge({ status }: { status: string }) {
  const c = STATE_COLORS[status] || {
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  };
  const live = LIVE_STATES.includes(status);
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset',
        c.chip,
      )}
    >
      <span className="relative flex w-1.5 h-1.5">
        {live && (
          <span
            className={cx(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-pulse',
              c.dot,
            )}
          />
        )}
        <span className={cx('relative inline-flex rounded-full w-1.5 h-1.5', c.dot)} />
      </span>
      {status}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
  icon: Icon,
  iconStyle,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
  icon?: LucideIcon;
  iconStyle?: React.CSSProperties;
}) {
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <div
            className="grid place-items-center w-9 h-9 rounded-xl text-white"
            style={iconStyle ?? { background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            <Icon size={17} />
          </div>
        )}
      </div>
      <p className={cx('text-3xl font-bold mt-2 tracking-tight', accent ?? 'text-slate-900')}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </Card>
  );
}

export function EmptyState({
  text,
  icon: Icon,
}: {
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="grid place-items-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mb-3">
          <Icon size={22} />
        </div>
      )}
      <p className="text-sm text-slate-400 max-w-xs">{text}</p>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={cx(
        'inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin',
        className,
      )}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center gap-3 text-slate-400 py-24">
      <Spinner className="text-blue-600" />
      <span className="text-sm">Carregando…</span>
    </div>
  );
}
