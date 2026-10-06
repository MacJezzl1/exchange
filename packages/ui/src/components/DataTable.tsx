import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  isNumeric?: boolean;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border-default)', borderRadius: '4px' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '8px 12px',
                  textAlign: col.align || (col.isNumeric ? 'right' : 'left'),
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}
              >
                Loading records...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={row.id ? String(row.id) : idx}
                onClick={() => onRowClick && onRowClick(row)}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  backgroundColor: 'var(--bg-surface)',
                  transition: 'background-color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                }}
              >
                {columns.map((col) => {
                  const val = (row as Record<string, unknown>)[col.key];
                  return (
                    <td
                      key={col.key}
                      style={{
                        padding: '8px 12px',
                        textAlign: col.align || (col.isNumeric ? 'right' : 'left'),
                        color: 'var(--text-primary)',
                        fontFamily: col.isNumeric ? 'var(--font-mono)' : 'var(--font-sans)',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.render ? col.render(row) : (val !== undefined && val !== null ? String(val) : '—')}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
