'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Password input with hover-to-reveal eye icon.
 * Password is hidden by default; hovering the icon shows it; leaving hides it.
 * No click required.
 */
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-default select-none"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible
          ? <EyeOff className="h-4 w-4" />
          : <Eye    className="h-4 w-4" />}
      </span>
    </div>
  );
}
