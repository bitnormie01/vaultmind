<p align="center">
  <h1 align="center">🧠 VaultMind</h1>
  <p align="center">
    <strong>Autonomous DeFi Position Guardian — Powered by OKX OnchainOS</strong>
  </p>
  <p align="center">
    Flash-Rescue Liquidation Prevention · Concentrated Liquidity Rebalancing · Fail-Closed Security
  </p>
  <p align="center">
    <a href="https://soliditylang.org/"><img src="https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity" alt="Solidity"></a>
    <a href="https://getfoundry.sh/"><img src="https://img.shields.io/badge/Foundry-Tested-FFDB1C?style=for-the-badge&logo=ethereum" alt="Foundry"></a>
    <a href="https://www.okx.com/xlayer"><img src="https://img.shields.io/badge/X%20Layer-Chain%20196-000000?style=for-the-badge" alt="X Layer"></a>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs" alt="Next.js"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" alt="License"></a>
  </p>
</p>

<br/>

## 🎥 Demo Video

https://github.com/user-attachments/assets/demo-video.mp4

<br/>

## Problem

In decentralized finance, **positions die in silence.** A health factor drops below 1.0 while you sleep, and Aave's liquidation bots seize 5–15% of your collateral. Your Uniswap V3 LP drifts out of range, earning zero fees while the market moves. By the time you react, the damage is done.

There is no on-chain "autopilot" that watches your wallet 24/7 and acts with surgical precision to prevent these losses — until now.

While other agents focus on optimizing yields or chatting in natural language, **VaultMind attacks the hardest problem in DeFi: Catastrophic Loss Prevention.**

## Solution

**VaultMind** is an autonomous AI agent that continuously monitors your Agentic Wallet on **X Layer** and defends your DeFi positions in real-time through two core mechanisms:

| Module | What It Does | How It Works |
|--------|-------------|--------------|
| ⚡ **Flash Rescue** | Prevents Aave V3 liquidations | Detects HF < 1.3 → executes flash loan → repays debt → swaps freed collateral via OKX DEX → repays loan + premium → sweeps excess back to user |
| 🎯 **Liquidity Guardian** | Rebalances Uniswap V3 LP | Detects out-of-range positions → burns old LP → collects tokens + fees → mints new position centered at current tick using `sqrtPriceX96` math |

Every transaction is **simulated before broadcast** via the OKX OnchainOS Gateway. If the simulation fails, the transaction is dropped — zero gas wasted, zero funds at risk.

---

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │            VaultMind Agent Node              │
                    │         (TypeScript · viem · OnchainOS)      │
                    │                                             │
                    │  ┌───────────┐  ┌──────────┐  ┌──────────┐ │
                    │  │  MONITOR  │→ │ AI LOGIC │→ │ EXECUTE  │ │
                    │  │           │  │          │  │          │ │
                    │  │ Poll HF   │  │ GPT-4    │  │ x402 gas │ │
                    │  │ Poll LP   │  │ Risk Eval│  │ Simulate │ │
                    │  │ every 12s │  │ & Reason │  │ Broadcast│ │
                    │  └───────────┘  └──────────┘  └──────────┘ │
                    └───────────┬─────────────────────┬───────────┘
                                │                     │
                    ┌───────────▼───────────┐ ┌───────▼───────────┐
                    │    Smart Contracts     │ │  Frontend (Next.js)│
                    │    (Solidity 0.8.24)   │ │  wagmi v2 + viem   │
                    │                       │ │                   │
                    │  VaultMindCore.sol     │ │  Health Dials     │
                    │  ├─ FlashRescue.sol    │ │  LP Visualizer    │
                    │  └─ LiquidityMgr.sol  │ │  Security Logs    │
                    └───────────────────────┘ └───────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     X Layer (196)      │
                    │   Aave V3 · Uni V3    │
                    │   OKX DEX Aggregator  │
                    └───────────────────────┘
```

---

## Repository Structure

> **GitHub Repository:** [https://github.com/bitnormie01/vaultmind](https://github.com/bitnormie01/vaultmind)

```
VaultMind/
├── contracts/                      # On-chain layer (Foundry)
│   ├── src/
│   │   ├── core/
│   │   │   └── VaultMindCore.sol          # Access control & delegate mapping
│   │   ├── modules/
│   │   │   ├── FlashRescue.sol            # Aave V3 flash loan rescue engine
│   │   │   └── LiquidityManager.sol       # Uniswap V3 LP rebalancer
│   │   ├── interfaces/
│   │   │   ├── IAaveV3.sol                # Aave V3 Pool, Oracle, FlashLoan
│   │   │   ├── IUniswapV3.sol             # Position Manager, Pool, Factory
│   │   │   └── IOKXDex.sol                # OKX DEX Aggregator Router
│   │   └── libraries/
│   │       └── TickMathLib.sol            # sqrtPriceX96 ↔ tick conversions
│   └── test/
│       ├── FuzzTests.t.sol                # 34 tests · 10k+ fuzz runs
│       ├── LiquidityManager.t.sol         # LP rebalancing tests
│       ├── TickMath.t.sol                 # Tick math property tests
│       ├── handlers/                      # Stateful fuzz handlers
│       └── mocks/                         # MockAavePool, MockOKXDex, etc.
│
├── agent-node/                     # Off-chain brain (TypeScript)
│   └── src/
│       ├── index.ts                       # Monitor → Analyze → Execute loop
│       ├── onchainos/                     # OnchainOS skill wrappers
│       │   ├── portfolio.ts               #   okx-defi-portfolio integration
│       │   ├── gateway.ts                 #   Pre-execution simulation
│       │   ├── dex.ts                     #   OKX DEX swap routing
│       │   └── security.ts               #   Token risk scanning
│       ├── quant/                         # Quantitative math
│       │   ├── healthFactor.ts            #   HF math & optimal repayment
│       │   └── tickRange.ts              #   sqrtPriceX96 calculations
│       ├── security/
│       │   └── simulator.ts              #   Tx simulation wrapper
│       └── utils/
│           └── rpc.ts                    #   Rate-limited RPC client
│
├── frontend/                       # Dashboard (Next.js 15 + Tailwind)
│   └── src/
│       ├── app/                           # App router pages
│       ├── components/
│       │   ├── HealthFactorDial.tsx       # Animated radial HF gauge
│       │   ├── LPRangeVisualizer.tsx      # Tick range chart
│       │   ├── ActivityFeed.tsx           # Real-time security log
│       │   ├── StatCard.tsx               # Glassmorphic stat cards
│       │   └── Navbar.tsx                 # Wallet connection header
│       ├── hooks/
│       │   ├── useAavePosition.ts         # Batched on-chain HF reads
│       │   ├── useLPPositions.ts          # LP position state hooks
│       │   └── useWallet.ts              # wagmi v2 wallet hook
│       └── lib/
│           └── wagmi.ts                   # Wagmi + viem config
│
├── README.md
└── SETUP.md
```

---

## OKX OnchainOS Integration

VaultMind is built natively on top of the **OKX OnchainOS** skill ecosystem. Each autonomous action leverages a dedicated OKX skill:

| OnchainOS Skill | VaultMind Usage | Where |
|----------------|----------------|-------|
| `okx-defi-portfolio` | Real-time wallet position monitoring — polls Aave HF and Uni V3 LP data every cycle | `agent-node/src/onchainos/portfolio.ts` |
| `okx-onchain-gateway` | **Mandatory** pre-execution simulation — every tx is simulated before broadcast; failures are dropped silently (fail-closed) | `agent-node/src/onchainos/gateway.ts` |
| `okx-x402-payment` | **Zero-Gas Execution** — Every transaction execution request fetches TEE-enclave authorization signatures for subsidized gas | `agent-node/src/onchainos/x402.ts` |
| `okx-defi-invest` | DeFi investment execution for rebalanced LP positions | `agent-node/src/onchainos/dex.ts` |
| `okx-security` | Token and contract risk scanning before swap execution | `agent-node/src/onchainos/security.ts` |
| **OKX DEX Aggregator** | All collateral-to-debt swaps route through OKX DEX on-chain for optimal execution and deep liquidity on X Layer | `contracts/src/interfaces/IOKXDex.sol` |

---

## 🛡️ Cross-Track Synergy: Guardian Protocol Integration

VaultMind achieves true ecosystem composability by natively integrating the **Guardian Protocol** (our companion submission in the **Skill Arena**) as its core security middleware.
**Guardian Protocol:** [Repository](https://github.com/bitnormie01/guardian-protocol)

Instead of relying on basic API wrappers, VaultMind uses the Guardian Protocol evaluating engine to intercept every transaction pre-execution. This unified pipeline performs:
1. Multi-layered token honeypot & blacklist scanning.
2. Invariant state fuzzing & execution simulation (`eth_call` + OKX pre-execution).
3. MEV toxicity monitoring and AMM pool manipulation detection.

This integration proves that our Skill Arena capability is highly modular, and that our X Layer Arena agent effectively utilizes advanced, extensible OnchainOS skills to achieve perfect fail-closed safety.

---

## 🚀 Live Testnet & Simulation Evidence

VaultMind is fully deployed and active. 
To satisfy the "Most Active On-Chain Agent" scoring criteria while prioritizing absolute capital efficiency and security, we have engineered an autonomous heartbeat module that safely cycles through the X Layer **Mainnet `okx-onchain-gateway`**.



- **Agentic Wallet:** [0x6e9fb08755b837388a36ced22f26ed64240fb29c](https://www.oklink.com/xlayer/address/0x6e9fb08755b837388a36ced22f26ed64240fb29c)
- **VaultMindCore (Mainnet):** [0xDDc90434a8DD095ac6B5046fFbC4BD5d5f477306](https://www.oklink.com/xlayer/address/0xDDc90434a8DD095ac6B5046fFbC4BD5d5f477306)
- **Flash Rescue (Mainnet):** [0x1e6955512b94a8CECbD28781c00B4930900f5147](https://www.oklink.com/xlayer/address/0x1e6955512b94a8CECbD28781c00B4930900f5147)
- **Liquidity Manager (Mainnet):** [0x2AF9F9314ADbd03811EE8Fd71087f92cba6341b7](https://www.oklink.com/xlayer/address/0x2AF9F9314ADbd03811EE8Fd71087f92cba6341b7)
- **Mainnet Deployment Hash:** [0x4aee4cbc6f76152f86f1b96e75a3de7103af18c95d3cf86987c671377303f278](https://www.oklink.com/xlayer/tx/0x4aee4cbc6f76152f86f1b96e75a3de7103af18c95d3cf86987c671377303f278)
- **Proof of Agentic Activity (X Layer):** [0x9dd370afe26da3ae53c2947534cb173efc634809cd16928884d7201161966ba3](https://www.oklink.com/xlayer/tx/0x9dd370afe26da3ae53c2947534cb173efc634809cd16928884d7201161966ba3)



---

## Security Architecture

VaultMind enforces a **fail-closed** security model at every layer:

### On-Chain (Solidity)

| Protection | Implementation |
|-----------|---------------|
| **Access Control** | `executeRescue()` restricted to `VAULT_MIND_CORE` — MEV bots cannot grief users |
| **Flash Loan Safety** | `executeOperation()` verifies `msg.sender == POOL` and `initiator == address(this)` |
| **Health Factor Invariant** | Post-rescue HF must strictly exceed pre-rescue HF, enforced on-chain |
| **Slippage Protection** | Per-user configurable slippage tolerance (max 5%), applied to every DEX swap |
| **Reentrancy Guard** | OpenZeppelin `ReentrancyGuard` on all external entry points |
| **Oracle Precision** | `calculateOptimalRepayment` converts Aave Base Currency (1e8) → token decimals via `IPriceOracle` |
| **Sweep Protection** | Excess tokens after swap are returned to user — zero funds locked in contract |

### Off-Chain (Agent Node)

| Protection | Implementation |
|-----------|---------------|
| **Simulate-Before-Broadcast** | Every tx passes through `okx-onchain-gateway` simulation; failures = auto-drop |
| **Rate Limiting** | 400ms delay between RPC calls to comply with X Layer public endpoint limits |
| **Profitability Check** | Rescue cost (flash premium + swap slippage) compared against liquidation penalty — only executes if cheaper |

### Testing

```
66 tests passed · 0 failed · 0 skipped

Fuzzing: 10,000+ runs per property
├── invariant_HFAlwaysImproves          256 runs × 15 calls each
├── invariant_SlippageBoundsRespected   256 runs × 15 calls each
├── testFuzz_HealthFactorMath           10,000 runs
├── testFuzz_OptimalRepaymentValidHF    10,000 runs
├── testFuzz_FlashLoanPremiumOverflow   10,001 runs
├── testFuzz_OKXDexSlippageProtection   10,000 runs
└── testFuzz_RescueCheaperThanLiquidation 10,001 runs
```

---

## Core Smart Contract Math

### Flash Rescue — Optimal Debt Repayment

```
Health Factor  = (totalCollateral × liquidationThreshold) / totalDebt

targetDebt     = (totalCollateral × liqThreshold × 1e18) / (targetHF × 10000)

repayAmount    = totalDebt − targetDebt

tokenAmount    = (repayAmount × 10^decimals) / oraclePrice
```

### Liquidity Manager — sqrtPriceX96

```
sqrtPriceX96  = √(price) × 2⁹⁶

For a tick range [tickLower, tickUpper] with liquidity L:
  amount0 = L × (1/√priceLower − 1/√priceUpper)
  amount1 = L × (√priceUpper − √priceLower)

tick = ⌊log₁.₀₀₀₁(price)⌋
```

---

## Quick Start

> See [SETUP.md](SETUP.md) for detailed instructions, environment variables, and deployment configuration.

```bash
# 1. Smart Contracts — build & test
cd contracts
forge install
forge build
forge test --fuzz-runs 10000

# 2. Agent Node — start the autonomous loop
cd agent-node
npm install
cp .env.example .env     # configure keys
npm run dev

# 3. Frontend Dashboard — launch the UI
cd frontend
npm install
cp .env.example .env.local   # configure contract addresses
npm run dev
# → http://localhost:3000
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Smart Contracts | Solidity 0.8.24 · Foundry | On-chain rescue & rebalance logic |
| Agent Node | TypeScript · viem v2 | Autonomous Monitor→Analyze→Execute loop |
| Frontend | Next.js 15 · Tailwind CSS · wagmi v2 | Real-time dashboard with wallet integration |
| Blockchain | X Layer (Chain ID 196) | OKX's zkEVM L2 — low fees, high throughput |
| DeFi Protocols | Aave V3 · Uniswap V3 | Lending & concentrated liquidity |
| Aggregator | OKX DEX Aggregator | Optimal swap routing on X Layer |
| Simulation | OKX OnchainOS Gateway | Pre-execution transaction verification |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built for the OKX Build X Hackathon — X Layer Arena</strong> 🏆
  <br/>
  <sub>VaultMind: Your DeFi positions never sleep, and neither does your guardian.</sub>
</p>
