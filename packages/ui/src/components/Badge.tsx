import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 500,
    borderRadius: '2px',
    lineHeight: 1,
    fontFamily: 'var(--font-sans)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    ...style,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '2px 5px', fontSize: '10px' },
    md: { padding: '4px 8px', fontSize: '11px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--bg-surface-elevated)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-default)',
    },
    success: {
      backgroundColor: 'var(--buy-subtle)',
      color: 'var(--buy-text)',
      border: '1px solid rgba(0, 176, 116, 0.25)',
    },
    danger: {
      backgroundColor: 'var(--sell-subtle)',
      color: 'var(--sell-text)',
      border: '1px solid rgba(246, 70, 93, 0.25)',
    },
    warning: {
      backgroundColor: 'var(--warning-subtle)',
      color: 'var(--warning-text)',
      border: '1px solid rgba(240, 185, 11, 0.25)',
    },
    info: {
      backgroundColor: 'var(--info-subtle)',
      color: 'var(--info-primary)',
      border: '1px solid rgba(59, 130, 246, 0.25)',
    },
  };

  return (
    <span
      style={{ ...baseStyle, ...sizeStyles[size], ...variantStyles[variant] }}
      className={`exchange-badge exchange-badge-${variant} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
