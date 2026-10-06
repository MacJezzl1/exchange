import { UUID } from '@exchange/shared-types';

export interface WithdrawalRiskEvaluationParams {
  userId: UUID;
  userKycTier: number; // 0=Browse, 1=Basic, 2=Full, 3=Institutional
  amountUSD: number;
  isAddressWhitelisted: boolean;
  rolling24hVolumeUSD: number;
  isPanicFrozen: boolean;
}

export interface WithdrawalRiskAssessment {
  isAllowed: boolean;
  riskScore: number; // 0 (safest) to 100 (highest risk)
  requiresFourEyesApproval: boolean;
  reasons: string[];
}

export class WithdrawalSafetyEngine {
  private readonly tierDailyLimitsUSD: Record<number, number> = {
    0: 0,
    1: 5000,
    2: 50000,
    3: 500000,
  };

  private readonly FOUR_EYES_APPROVAL_THRESHOLD_USD = 10000;

  public evaluateWithdrawal(params: WithdrawalRiskEvaluationParams): WithdrawalRiskAssessment {
    const reasons: string[] = [];
    let riskScore = 0;

    // 1. Critical safety checks
    if (params.isPanicFrozen) {
      return {
        isAllowed: false,
        riskScore: 100,
        requiresFourEyesApproval: false,
        reasons: ['Account is panic-frozen'],
      };
    }

    const tierLimit = this.tierDailyLimitsUSD[params.userKycTier] ?? 0;
    if (params.userKycTier === 0 || tierLimit === 0) {
      return {
        isAllowed: false,
        riskScore: 90,
        requiresFourEyesApproval: false,
        reasons: ['KYC verification required. Tier L0 cannot withdraw.'],
      };
    }

    if (params.rolling24hVolumeUSD + params.amountUSD > tierLimit) {
      return {
        isAllowed: false,
        riskScore: 85,
        requiresFourEyesApproval: false,
        reasons: [`24h limit of $${tierLimit.toLocaleString()} exceeded for Tier ${params.userKycTier}`],
      };
    }

    // 2. Risk scoring factors
    if (!params.isAddressWhitelisted) {
      riskScore += 35;
      reasons.push('Destination address is not whitelisted or timelock has not expired');
    }

    if (params.amountUSD >= this.FOUR_EYES_APPROVAL_THRESHOLD_USD) {
      riskScore += 30;
      reasons.push(`Amount ($${params.amountUSD.toLocaleString()}) meets/exceeds 4-eyes approval threshold ($${this.FOUR_EYES_APPROVAL_THRESHOLD_USD.toLocaleString()})`);
    }

    // Determine if Maker-Checker Four-Eyes Approval is required
    const requiresFourEyesApproval =
      params.amountUSD >= this.FOUR_EYES_APPROVAL_THRESHOLD_USD || riskScore >= 50;

    return {
      isAllowed: true,
      riskScore,
      requiresFourEyesApproval,
      reasons,
    };
  }
}
