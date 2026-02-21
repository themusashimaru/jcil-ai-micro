'use client';

/**
 * DESIGN SYSTEM: Input
 *
 * Text input with label, error state, and accessibility.
 * Supports all native input types plus textarea mode.
 */

import React, { forwardRef } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

interface BaseInputProps {
  label?: string;
  error?: string;
  hint?: string;
  inputSize?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

type InputProps = BaseInputProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>;

type TextareaProps = BaseInputProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
    multiline: true;
  };

const sizeStyles: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-3 py-2 text-sm rounded-lg',
  lg: 'px-4 py-3 text-base rounded-lg',
};

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps | TextareaProps>(
  function Input(props, ref) {
    const {
      label,
      error,
      hint,
      inputSize = 'md',
      leftIcon,
      rightIcon,
      fullWidth = true,
      className = '',
      id,
      ...rest
    } = props;

    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint && !error ? `${inputId}-hint` : undefined;
    const isMultiline = 'multiline' in props && props.multiline;

    const baseClasses = [
      'w-full transition-colors duration-150',
      'bg-[var(--glass-bg)] text-[var(--text-primary)]',
      'border placeholder:text-[var(--text-muted)]',
      'focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      error ? 'border-red-500 focus:ring-red-500' : 'border-[var(--border)]',
      sizeStyles[inputSize],
      leftIcon ? 'pl-10' : '',
      rightIcon ? 'pr-10' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inputElement = isMultiline ? (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        id={inputId}
        className={baseClasses}
        aria-invalid={!!error}
        aria-describedby={errorId || hintId || undefined}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    ) : (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        id={inputId}
        className={baseClasses}
        aria-invalid={!!error}
        aria-describedby={errorId || hintId || undefined}
        {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    );

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {leftIcon}
            </div>
          )}
          {inputElement}
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-[var(--text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

export default Input;
