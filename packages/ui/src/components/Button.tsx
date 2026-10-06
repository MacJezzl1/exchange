import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'buy' | 'sell' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    borderRadius: '4px',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 120ms ease-in-out',
    fontFamily: 'var(--font-sans)',
    border: '1px solid transparent',
    outline: 'none',
    userSelect: 'none',
    ...style,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '4px 8px', fontSize: '11px', height: '24px' },
    md: { padding: '6px 12px', fontSize: '13px', height: '32px' },
    lg: { padding: '8px 16px', fontSize: '14px', height: '40px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent-default)',
      color: '#ffffff',
    },
    secondary: {
      backgroundColor: 'var(--bg-surface-elevated)',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-default)',
    },
    buy: {
      backgroundColor: 'var(--buy-primary)',
      color: '#ffffff',
    },
    sell: {
      backgroundColor: 'var(--sell-primary)',
      color: '#ffffff',
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: 'var(--border-default)',
      color: 'var(--text-primary)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
    },
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{ ...baseStyle, ...sizeStyles[size], ...variantStyles[variant] }}
      className={`exchange-btn exchange-btn-${variant} ${className}`}
      {...props}
    >
      {isLoading ? 'Processing...' : children}
    </button>
  );
};
