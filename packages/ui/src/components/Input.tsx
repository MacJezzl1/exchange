import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  prefixSymbol?: string;
  suffixSymbol?: string;
  error?: string;
  isMono?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  prefixSymbol,
  suffixSymbol,
  error,
  isMono = false,
  className = '',
  style,
  disabled,
  ...props
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {label && (
        <label
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: `1px solid ${error ? 'var(--sell-primary)' : 'var(--border-default)'}`,
          borderRadius: '4px',
          padding: '0 8px',
          height: '32px',
          boxSizing: 'border-box',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {prefixSymbol && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              marginRight: '6px',
              userSelect: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {prefixSymbol}
          </span>
        )}
        <input
          disabled={disabled}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontFamily: isMono ? 'var(--font-mono)' : 'var(--font-sans)',
            fontVariantNumeric: 'tabular-nums',
            width: '100%',
            ...style,
          }}
          className={`exchange-input ${className}`}
          {...props}
        />
        {suffixSymbol && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              marginLeft: '6px',
              userSelect: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {suffixSymbol}
          </span>
        )}
      </div>
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--sell-text)', fontFamily: 'var(--font-sans)' }}>
          {error}
        </span>
      )}
    </div>
  );
};
