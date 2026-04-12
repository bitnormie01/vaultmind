/**
 * Tick Range Analyzer
 *
 * Quantitative logic for Uniswap V3 tick boundary calculations.
 * Determines when LP positions are out of range and calculates
 * optimal new tick ranges for rebalancing.
 *
 * Key Math:
 *   sqrtPriceX96 = sqrt(price) × 2^96
 *   price = (sqrtPriceX96 / 2^96)²
 *   tick = floor(log_1.0001(price))
 *
 * For a given range [tickLower, tickUpper] and liquidity L:
 *   amount0 = L × (1/sqrt(priceLower) - 1/sqrt(priceUpper))
 *   amount1 = L × (sqrt(priceUpper) - sqrt(priceLower))
 */

const Q96 = BigInt(2) ** BigInt(96);

interface TickRange {
  lower: number;
  upper: number;
}

export class TickRangeAnalyzer {
  /**
   * Check if a position is out of range
   */
  isOutOfRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
    return currentTick < tickLower || currentTick >= tickUpper;
  }

  /**
   * Calculate the optimal new tick range centered around the current tick
   *
   * @param currentTick The current pool tick
   * @param tickSpacing The pool's tick spacing (10, 60, or 200)
   * @param spreadMultiplier Number of tick spacings above/below current tick
   */
  calculateOptimalRange(
    currentTick: number,
    tickSpacing: number,
    spreadMultiplier: number = 10
  ): TickRange {
    // Align the current tick to the tick spacing (floor division toward -infinity)
    const alignedTick = Math.floor(currentTick / tickSpacing) * tickSpacing;

    const lower = alignedTick - spreadMultiplier * tickSpacing;
    const upper = alignedTick + spreadMultiplier * tickSpacing;

    return { lower, upper };
  }

  /**
   * Calculate how far out of range a position is (in ticks)
   * Positive = above range, Negative = below range, Zero = in range
   */
  rangeDistance(currentTick: number, tickLower: number, tickUpper: number): number {
    if (currentTick < tickLower) return tickLower - currentTick; // Below range
    if (currentTick >= tickUpper) return currentTick - tickUpper + 1; // Above range
    return 0; // In range
  }

  /**
   * Convert tick to approximate price
   * price = 1.0001^tick
   */
  tickToPrice(tick: number): number {
    return Math.pow(1.0001, tick);
  }

  /**
   * Convert price to approximate tick
   * tick = floor(log(price) / log(1.0001))
   */
  priceToTick(price: number): number {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }

  /**
   * Calculate sqrtPriceX96 from a tick
   * sqrtPriceX96 = sqrt(1.0001^tick) × 2^96
   */
  tickToSqrtPriceX96(tick: number): bigint {
    const sqrtPrice = Math.sqrt(Math.pow(1.0001, tick));
    return BigInt(Math.floor(sqrtPrice * Number(Q96)));
  }

  /**
   * Calculate the required amounts of token0 and token1 for a given
   * liquidity and tick range.
   *
   * amount0 = L × (1/sqrt(priceLower) - 1/sqrt(priceUpper))
   * amount1 = L × (sqrt(priceUpper) - sqrt(priceLower))
   */
  calculateAmounts(
    liquidity: number,
    currentTick: number,
    tickLower: number,
    tickUpper: number
  ): { amount0: number; amount1: number } {
    const sqrtPriceLower = Math.sqrt(Math.pow(1.0001, tickLower));
    const sqrtPriceUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
    const sqrtPriceCurrent = Math.sqrt(Math.pow(1.0001, currentTick));

    let amount0 = 0;
    let amount1 = 0;

    if (currentTick < tickLower) {
      // Position is entirely in token0
      amount0 = liquidity * (1 / sqrtPriceLower - 1 / sqrtPriceUpper);
    } else if (currentTick >= tickUpper) {
      // Position is entirely in token1
      amount1 = liquidity * (sqrtPriceUpper - sqrtPriceLower);
    } else {
      // Current price is within the range — both tokens needed
      amount0 = liquidity * (1 / sqrtPriceCurrent - 1 / sqrtPriceUpper);
      amount1 = liquidity * (sqrtPriceCurrent - sqrtPriceLower);
    }

    return { amount0, amount1 };
  }
}
