import { UUID } from '@exchange/shared-types';

export type TaxJurisdiction = 'SARS' | 'FIRS' | 'KRA' | 'IRS';

export interface TradeTaxEvent {
  tradeId: UUID;
  timestamp: string;
  asset: string;
  side: 'buy' | 'sell';
  quantity: bigint;
  unitPriceFiat: bigint;
  feeFiat: bigint;
}

export interface TaxLot {
  lotId: UUID;
  acquiredAt: string;
  asset: string;
  remainingQuantity: bigint;
  costBasisPerUnit: bigint;
}

export interface RealizedGainLoss {
  dispositionTradeId: UUID;
  dispositionTimestamp: string;
  asset: string;
  quantitySold: bigint;
  proceedsFiat: bigint;
  costBasisFiat: bigint;
  gainLossFiat: bigint; // Positive = gain, Negative = loss
  isGain: boolean;
}

export interface TaxReportSummary {
  userId: UUID;
  taxYear: number;
  jurisdiction: TaxJurisdiction;
  totalProceedsFiat: string;
  totalCostBasisFiat: string;
  netCapitalGainFiat: string;
  isNetGain: boolean;
  eventCount: number;
}
