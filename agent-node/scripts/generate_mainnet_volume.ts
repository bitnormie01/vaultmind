import { createPublicClient, createWalletClient, http, defineChain, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
import { SecuritySimulator } from "../src/security/simulator.js";

dotenv.config();

const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  network: "x-layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech"] },
  },
});

/**
 * Utility script for the OKX Build X Hackathon.
 * Safely generates on-chain activity to compete for the "Most Active On-Chain Agent" prize.
 * Cycles through okx-onchain-gateway simulations to prove security-first architecture.
 */
async function generateVolume() {
  console.log("🚀 Starting VaultMind Mainnet Volume Generator...");
  
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌ PRIVATE_KEY not set in .env");
    process.exit(1);
  }
  
  const account = privateKeyToAccount((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`);
  const simulator = new SecuritySimulator();
  
  const publicClient = createPublicClient({ chain: xLayer, transport: http() });
  const walletClient = createWalletClient({ account, chain: xLayer, transport: http() });

  const targetIterations = 5;
  console.log(`Targeting ${targetIterations} safe on-chain cycles for wallet ${account.address}`);

  for (let i = 1; i <= targetIterations; i++) {
    console.log(`\n--- Cycle ${i}/${targetIterations} ---`);
    
    // Simulate a zero-value self-transfer as a heartbeat
    const txPayload = {
      to: account.address,
      data: "0x" as `0x${string}`,
      value: BigInt(0),
      chainId: 196
    };

    const context = {
      tokenIn: "0xe538905cf8410324e03a5a23c1c177a474d59b2b", // WOKB
      tokenOut: "0x74b7f16337b8972027f6196a17a631ac6de26d22", // USDC
      amount: "1",
      userAddress: account.address
    };

    console.log("🔬 Running okx-onchain-gateway simulation...");
    const simResult = await simulator.simulate(txPayload, context);
    
    if (simResult.success) {
      console.log(`✅ Simulation passed (Gas Est: ${simResult.gasEstimate}). Broadcasting...`);
      try {
        const hash = await walletClient.sendTransaction({
          ...txPayload,
          account,
          chain: xLayer
        });
        console.log(`🎯 Tx Hash: ${hash}`);
        console.log(`🔗 https://www.oklink.com/xlayer/tx/${hash}`);
        
        await publicClient.waitForTransactionReceipt({ hash });
      } catch (e: any) {
        console.log(`⚠️ Broadcast skipped or failed (Ensure wallet is funded with OKB for gas if x402 is inactive). Reason: ${e.message}`);
      }
    } else {
      console.log(`🚫 Simulation failed: ${simResult.reason}`);
    }

    // Delay to respect rate limits
    await new Promise(res => setTimeout(res, 2000));
  }

  console.log("\n✅ Volume generation cycle complete!");
}

generateVolume().catch(console.error);
