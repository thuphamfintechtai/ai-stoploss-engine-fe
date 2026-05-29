import React, { forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  errorMessage?: string;
  label?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  options,
  size = 'md',
  error = false,
  errorMessage,
  label,
  placeholder,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `select-${Math.random().toString(36).slice(2, 9)}`;

  const sizeClasses = {
    sm: 'input-sm',
    md: '',
    lg: 'input-lg',
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-caption text-muted">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        className={`input ${sizeClasses[size]} ${error ? 'input-error' : ''} cursor-pointer ${className}`}
        aria-invalid={error}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {errorMessage && (
        <span className="text-caption text-negative" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
