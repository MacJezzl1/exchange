# ADR-0008: Frontend Architecture with Next.js App Router, Strict Design Tokens, and Lightweight Charts

## Status
Accepted

## Context
Section 9 mandates a serious fintech aesthetic: calm, dense, precise, with no generic crypto templates, no glassmorphism cliches, and strict separation between the Trader App (`apps/web`), the Admin App (`apps/admin`), and the Status Page (`apps/status`).

## Decision
1. **Framework**: Next.js (App Router) with TypeScript strict mode across all three web applications.
2. **Styling & Tokens**: Custom token system (`packages/ui/src/tokens/`) using CSS custom properties for dark and light modes. Zero hardcoded hex values in component code.
3. **Trading Charts**: TradingView's `lightweight-charts` for interactive candlestick and depth visualizations.
4. **Data Fetching & State**: TanStack Query (React Query) for server state synchronization and caching; lightweight Zustand store for client-only trading layout states.
5. **App Isolation**: The Admin App is built as a separate Next.js application on a distinct domain (`admin.<domain>`), preventing shared cookies or session leakage.

## Consequences
- **Positive**: High rendering performance, dense tabular typography, zero style pollution between trader and admin shells, WCAG AA compliance.
- **Negative**: Requires custom UI components rather than ready-made consumer UI libraries to maintain institutional density.
