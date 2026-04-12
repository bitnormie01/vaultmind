/**
 * Health Factor Analyzer
 *
 * Quantitative logic for determining when an Aave V3 position
 * needs rescue and calculating optimal repayment amounts.
 *
 * Math:
 *   Health Factor (HF) = (totalCollateral × liquidationThreshold) / totalDebt
 *   All values in 1e18 precision (Aave V3 standard)
 *
 *   To bring HF from current to target:
 *     repayAmount = totalDebt - (totalCollateral × liqThreshold / targetHF)
 */

const HF_PRECISION = BigInt(1e18);
const BPS_DENOMINATOR = BigInt(10_000);

export class HealthFactorAnalyzer {
  /**
   * Check if a rescue operation is needed
   * @param currentHF Current health factor (1e18 precision)
   * @param threshold Threshold below which rescue is triggered (e.g., 1.3)
   */
  isRescueNeeded(currentHF: bigint, threshold: number): boolean {
    const thresholdBigInt = BigInt(Math.floor(threshold * 1e18));
    return currentHF < thresholdBigInt && currentHF > BigInt(0);
  }

  /**
   * Calculate the optimal debt repayment to reach target health factor
   *
   * Formula:
   *   targetDebt = (collateral × liqThreshold) / targetHF
   *   repayAmount = currentDebt - targetDebt
   *
   * @param totalCollateral Total collateral in base units (1e18)
   * @param totalDebt Total debt in base units (1e18)
   * @param targetHF Target health factor (1e18 precision)
   * @param liqThreshold Liquidation threshold in BPS (e.g., 8250 = 82.5%)
   */
  calculateOptimalRepayment(
    totalCollateral: bigint,
    totalDebt: bigint,
    targetHF: bigint,
    liqThreshold: bigint = BigInt(8250) // Default 82.5%
  ): bigint {
    if (totalDebt === BigInt(0)) return BigInt(0);

    // maxDebtForTarget = (collateral × liqThreshold × HF_PRECISION) / (targetHF × BPS_DENOM)
    const maxDebtForTarget =
      (totalCollateral * liqThreshold * HF_PRECISION) / (targetHF * BPS_DENOMINATOR);

    if (totalDebt <= maxDebtForTarget) return BigInt(0);

    return totalDebt - maxDebtForTarget;
  }

  /**
   * Estimate the cost of a rescue operation
   * Cost = flash loan premium (0.05%) + estimated swap slippage
   */
  estimateRescueCost(
    repayAmount: bigint,
    swapSlippageBps: number = 30 // 0.3% default
  ): { premiumCost: bigint; swapCost: bigint; totalCost: bigint } {
    const premiumCost = (repayAmount * BigInt(5)) / BPS_DENOMINATOR; // 0.05%
    const swapCost = (repayAmount * BigInt(swapSlippageBps)) / BPS_DENOMINATOR;
    const totalCost = premiumCost + swapCost;

    return { premiumCost, swapCost, totalCost };
  }

  /**
   * Compare rescue cost against liquidation penalty to verify profitability
   */
  isRescueProfitable(
    repayAmount: bigint,
    swapSlippageBps: number = 30,
    liquidationPenaltyBps: number = 500 // 5% default
  ): boolean {
    const { totalCost } = this.estimateRescueCost(repayAmount, swapSlippageBps);
    const liquidationCost = (repayAmount * BigInt(liquidationPenaltyBps)) / BPS_DENOMINATOR;

    return totalCost < liquidationCost;
  }
}
