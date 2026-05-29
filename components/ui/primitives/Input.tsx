import React, { forwardRef } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  error?: boolean;
  errorMessage?: string;
  label?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  isPrice?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  size = 'md',
  error = false,
  errorMessage,
  label,
  hint,
  leftAddon,
  rightAddon,
  isPrice = false,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

  const inputClasses = [
    'input',
    size !== 'md' ? `input-${size}` : '',
    error ? 'input-error' : '',
    isPrice ? 'input-price' : '',
    leftAddon ? 'pl-10' : '',
    rightAddon ? 'pr-10' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-caption text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        {leftAddon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dim">
            {leftAddon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={error}
          aria-describedby={errorMessage ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {rightAddon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-dim">
            {rightAddon}
          </div>
        )}
      </div>
      {errorMessage && (
        <span id={`${inputId}-error`} className="text-caption text-negative" role="alert">
          {errorMessage}
        </span>
      )}
      {hint && !errorMessage && (
        <span id={`${inputId}-hint`} className="text-caption text-dim">
          {hint}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  errorMessage?: string;
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  error = false,
  errorMessage,
  label,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-caption text-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={`input min-h-[80px] resize-y ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={error}
        {...props}
      />
      {errorMessage && (
        <span className="text-caption text-negative" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
