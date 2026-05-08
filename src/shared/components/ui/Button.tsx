'use client';

import { cn } from '@/shared/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-display tracking-tight transition-transform min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink disabled:opacity-50 disabled:pointer-events-none',
        {
          'bg-cta-bg text-cta-ink border border-ink shadow-theme hover:-translate-y-px active:translate-y-px':
            variant === 'primary',
          'bg-chip-bg text-ink border border-ink shadow-theme hover:-translate-y-px active:translate-y-px':
            variant === 'secondary',
          'bg-transparent text-ink hover:bg-ink/5 active:scale-95':
            variant === 'ghost',
        },
        {
          'text-sm px-4 py-2': size === 'sm',
          'text-base px-6 py-3': size === 'md',
          'text-lg px-8 py-4': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
