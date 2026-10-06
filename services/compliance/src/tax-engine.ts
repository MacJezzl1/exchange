import { v7 as uuidv7 } from 'uuid';
import { UUID } from '@exchange/shared-types';
import {
  TradeTaxEvent,
  TaxLot,
  RealizedGainLoss,
  TaxJurisdiction,
  TaxReportSummary,
} from './tax-types';

export class FifoTaxEngine {
  // Inventory of unspent tax lots per asset (FIFO queue)
  private readonly inventory = new Map<string, TaxLot[]>();
  private readonly realizedGains: RealizedGainLoss[] = [];

  public recordBuy(event: TradeTaxEvent): void {
    if (event.side !== 'buy') {
      throw new Error('recordBuy called with sell event');
    }

    const assetKey = event.asset.toUpperCase();
    const lots = this.inventory.get(assetKey) || [];

    // Total cost basis includes purchase price + fees apportioned
    const totalCost = event.quantity * event.unitPriceFiat + event.feeFiat;
    const costPerUnit = totalCost / event.quantity;

    const lot: TaxLot = {
      lotId: uuidv7(),
      acquiredAt: event.timestamp,
      asset: assetKey,
      remainingQuantity: event.quantity,
      costBasisPerUnit: costPerUnit,
    };

    lots.push(lot);
    this.inventory.set(assetKey, lots);
  }

  public recordSell(event: TradeTaxEvent): RealizedGainLoss[] {
    if (event.side !== 'sell') {
      throw new Error('recordSell called with buy event');
    }

    const assetKey = event.asset.toUpperCase();
    const lots = this.inventory.get(assetKey) || [];

    let remainingToSell = event.quantity;
    const generatedDispositions: RealizedGainLoss[] = [];

    while (remainingToSell > 0n && lots.length > 0) {
      const currentLot = lots[0]!;

      // Matched quantity from this lot
      const matchedQty =
        currentLot.remainingQuantity <= remainingToSell
          ? currentLot.remainingQuantity
          : remainingToSell;

      const proceeds = matchedQty * event.unitPriceFiat;
      const costBasis = matchedQty * currentLot.costBasisPerUnit;
      const gainLoss = proceeds - costBasis;

      const disposition: RealizedGainLoss = {
        dispositionTradeId: event.tradeId,
        dispositionTimestamp: event.timestamp,
        asset: assetKey,
        quantitySold: matchedQty,
        proceedsFiat: proceeds,
        costBasisFiat: costBasis,
        gainLossFiat: gainLoss,
        isGain: gainLoss >= 0n,
      };

      this.realizedGains.push(disposition);
      generatedDispositions.push(disposition);

      remainingToSell -= matchedQty;
      currentLot.remainingQuantity -= matchedQty;

      if (currentLot.remainingQuantity === 0n) {
        lots.shift(); // Lot fully consumed
      }
    }

    if (remainingToSell > 0n) {
      throw new Error(
        `Tax inventory deficit: Attempted to sell ${event.quantity.toString()} of ${assetKey}, but only ${
          (event.quantity - remainingToSell).toString()
        } was available in FIFO lots!`
      );
    }

    return generatedDispositions;
  }

  public generateTaxReport(
    userId: UUID,
    taxYear: number,
    jurisdiction: TaxJurisdiction
  ): TaxReportSummary {
    let totalProceeds = 0n;
    let totalCostBasis = 0n;

    for (const d of this.realizedGains) {
      totalProceeds += d.proceedsFiat;
      totalCostBasis += d.costBasisFiat;
    }

    const netCapitalGain = totalProceeds - totalCostBasis;

    return {
      userId,
      taxYear,
      jurisdiction,
      totalProceedsFiat: totalProceeds.toString(),
      totalCostBasisFiat: totalCostBasis.toString(),
      netCapitalGainFiat: netCapitalGain.toString(),
      isNetGain: netCapitalGain >= 0n,
      eventCount: this.realizedGains.length,
    };
  }

  public exportCsv(): string {
    const header = 'DispositionDate,Asset,QuantitySold,ProceedsFiat,CostBasisFiat,GainLossFiat,IsGain\n';
    const rows = this.realizedGains.map(
      (g) =>
        `${g.dispositionTimestamp},${g.asset},${g.quantitySold.toString()},${g.proceedsFiat.toString()},${g.costBasisFiat.toString()},${g.gainLossFiat.toString()},${g.isGain}`
    );
    return header + rows.join('\n');
  }
}
