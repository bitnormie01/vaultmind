/**
 * OnchainOS Security Wrapper
 *
 * Wraps the `okx-security` skill for token and contract risk analysis.
 * Used to validate token safety before executing swaps in rescue operations.
 */
import { sendGetRequest } from "./api.js";
export class SecurityChecker {
  /**
   * Check if a token is safe to interact with
   * Uses okx-security skill for comprehensive risk analysis
   */
  async checkTokenSafety(tokenAddress: string, chainId: number = 196): Promise<TokenSafetyResult> {
    try {
      const parsed = await sendGetRequest('/api/v6/security/token-scan', {
        token: tokenAddress,
        chainId: chainId
      });
      
      const riskData = parsed.data?.[0] || parsed;
      return {
        isSafe: parsed.code === '0' || riskData.riskLevel === "LOW",
        riskLevel: riskData.riskLevel || "LOW",
        warnings: riskData.warnings || [],
      };
    } catch (e) {
      // Fail-closed: if the security API is unreachable, treat as unsafe
      return {
        isSafe: false,
        riskLevel: "HIGH",
        warnings: [`okx-security API unreachable: ${e instanceof Error ? e.message : String(e)}`],
      };
    }
  }

  /**
   * Check if a smart contract is safe to interact with
   */
  async checkContractSafety(contractAddress: string): Promise<ContractSafetyResult> {
    // TODO: Integrate with okx-security CLI
    return {
      isVerified: true,
      hasProxy: false,
      riskFlags: [],
    };
  }
}

interface TokenSafetyResult {
  isSafe: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  warnings: string[];
}

interface ContractSafetyResult {
  isVerified: boolean;
  hasProxy: boolean;
  riskFlags: string[];
}
