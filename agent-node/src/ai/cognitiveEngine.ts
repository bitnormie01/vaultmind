import OpenAI from "openai";
import { createLogger } from "../utils/logger.js";

interface CognitiveContext {
  healthFactor: string;
  totalCollateral: string;
  totalDebt: string;
  lpPositionsCount: number;
}

interface CognitiveDecision {
  confidenceScore: number;
  reasoning: string;
  execute: boolean;
}

export class CognitiveEngine {
  private openai: OpenAI | null = null;
  private logger = createLogger("CognitiveEngine");

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== "fallback_key" && apiKey.length > 10) {
      this.openai = new OpenAI({ apiKey });
      this.logger.info("🧠 Initialized OpenAI Cognitive Engine.");
    } else {
      this.logger.warn("⚠️ No OPENAI_API_KEY detected. Running Cognitive Engine in Mock/Deterministic mode.");
    }
  }

  /**
   * Analyzes the proposed flash loan rescue using an LLM to provide a cognitive decision.
   */
  async analyzeRiskAndRescue(
    context: CognitiveContext,
    debtToRepay: string
  ): Promise<CognitiveDecision> {
    const prompt = `
You are the VaultMind AI Protocol. A DeFi wallet is at risk of liquidation on Aave V3.
Wallet Context: 
- Health Factor: ${context.healthFactor} (Threshold is 1.3)
- Total Collateral: ${context.totalCollateral} 
- Total Debt: ${context.totalDebt}

A quantitative module proposes executing a Flash Loan Rescue to repay ${debtToRepay} in debt.
Evaluate the market risk of doing this. Output your response as a JSON object strictly following this format:
{
  "confidenceScore": <number between 0 and 1>,
  "reasoning": "<string with your analysis>",
  "execute": <boolean>
}
`;

    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini", // fast and cheap for hackathons
          messages: [{ role: "system", content: "You are a quantitative DeFi AI agent." }, { role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
        });

        const content = response.choices[0].message.content;
        if (content) {
          const parsed = JSON.parse(content) as CognitiveDecision;
          this.logger.info(`🤖 AI Decision (Confidence: ${parsed.confidenceScore}): ${parsed.reasoning}`);
          return parsed;
        }
      } catch (err) {
        this.logger.error(`OpenAI error: ${err}`);
        // Fallback below
      }
    }

    // Mock fallback if OpenAI fails or key is missing
    const isCriticalRisk = parseFloat(context.healthFactor) < 1.3;
    const confidence = isCriticalRisk ? 0.98 : 0.4;
    const reasoning = isCriticalRisk 
      ? "AI Analysis: Health Factor critically low. High probability of incoming liquidation sandwich attack if unmitigated. Executing pre-emptive Flash Rescue." 
      : "AI Analysis: Position is healthy. Flash rescue unnecessary at this time.";

    const decision = {
      confidenceScore: confidence,
      reasoning,
      execute: isCriticalRisk
    };

    this.logger.info(`🤖 [MOCK] AI Decision (Confidence: ${decision.confidenceScore}): ${decision.reasoning}`);
    return decision;
  }

  /**
   * Analyzes an LP rebalance recommendation.
   */
  async analyzeLPRebalance(
    tokenId: bigint,
    currentTick: number,
    newRange: [number, number]
  ): Promise<CognitiveDecision> {
    // In a real scenario, this would have an LLM prompt. Below is the fast mock/fallback path.
    const confidence = 0.92;
    const reasoning = `AI Analysis: LP Position #${tokenId} is drifting out of optimal liquidity density. Rebalancing to ticks [${newRange[0]}, ${newRange[1]}] around current tick ${currentTick} maximizes fee capture while minimizing impermanent loss.`;

    const decision = {
      confidenceScore: confidence,
      reasoning,
      execute: true
    };

    this.logger.info(`🤖 [MOCK] AI Decision (Confidence: ${decision.confidenceScore}): ${decision.reasoning}`);
    return decision;
  }
}
