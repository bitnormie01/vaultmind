# VaultMind — Setup & Deployment Guide

> Complete guide to running VaultMind locally, configuring environment variables, and deploying to X Layer mainnet.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Foundry** | Latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **pnpm / npm** | Latest | `npm install -g pnpm` (optional) |
| **OKX OnchainOS CLI** | Latest | [OnchainOS Docs](https://www.okx.com/web3/build/docs/devportal/introduction-to-onchain-os) |
| **Git** | Latest | `sudo apt install git` |

---

## Monorepo Layout

```
VaultMind/
├── contracts/      Foundry project — Solidity 0.8.24
├── agent-node/     TypeScript autonomous agent
├── frontend/       Next.js 15 dashboard
├── README.md       Project overview
└── SETUP.md        ← you are here
```

---

## Step 1: Smart Contracts

### Install Dependencies

```bash
cd contracts
forge install
```

This pulls:
- `OpenZeppelin/openzeppelin-contracts` — ReentrancyGuard, SafeERC20, IERC20Metadata
- `aave/aave-v3-core` — IPool, IFlashLoanSimpleReceiver, IPriceOracle
- `Uniswap/v3-core` — IUniswapV3Pool, TickMath
- `Uniswap/v3-periphery` — INonfungiblePositionManager

### Build

```bash
forge build
```

### Test

```bash
# Standard test run
forge test

# Full fuzzing suite (recommended — 10k runs per property)
forge test --fuzz-runs 10000 -vv

# Run a specific test file
forge test --match-path test/FuzzTests.t.sol --fuzz-runs 10000 -vvv

# Gas report
forge test --gas-report
```

**Expected output:**

```
Ran 5 test suites: 66 tests passed, 0 failed, 0 skipped
```

### Deploy to X Layer Mainnet

```bash
export XLAYER_PRIVATE_KEY=<your-deployer-private-key>
export XLAYER_RPC_URL=https://rpc.xlayer.tech

# Deploy all contracts via the deployment script
forge script script/Deploy.s.sol:DeployVaultMind \
  --rpc-url $XLAYER_RPC_URL \
  --private-key $XLAYER_PRIVATE_KEY \
  --broadcast
```

---

## Step 2: Agent Node

### Install

```bash
cd agent-node
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` with the following values:

```env
# ═══════════════════════════════════════════════
#  VaultMind Agent Node Configuration
# ═══════════════════════════════════════════════

# ── Blockchain ──────────────────────────────────
XLAYER_RPC_URL=https://rpc.xlayer.tech
PRIVATE_KEY=<agent-wallet-private-key>

# ── Deployed Contract Addresses ────────────────
VAULTMIND_CORE_ADDRESS=0x...
FLASH_RESCUE_ADDRESS=0x...
LIQUIDITY_MANAGER_ADDRESS=0x...

# ── Aave V3 on X Layer ────────────────────────
AAVE_POOL_ADDRESS=0x...
AAVE_ADDRESSES_PROVIDER=0x...

# ── Uniswap V3 on X Layer ─────────────────────
UNISWAP_POSITION_MANAGER=0x...
UNISWAP_FACTORY=0x...

# ── OKX DEX ────────────────────────────────────
OKX_DEX_ROUTER=0x...

# ── Agent Parameters ──────────────────────────
POLL_INTERVAL_MS=12000
HF_THRESHOLD=1.3
TARGET_HF=1.5
MAX_SLIPPAGE_BPS=100
```

### Run

```bash
# Development (with ts-node)
npm run dev

# Production (compile + run)
npm run build
node dist/index.js
```

The agent will start the **Monitor → Analyze → Execute** loop, logging each cycle to stdout.

---

## Step 3: Frontend Dashboard

### Install

```bash
cd frontend
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# ═══════════════════════════════════════════════
#  VaultMind Frontend Configuration
# ═══════════════════════════════════════════════

NEXT_PUBLIC_XLAYER_RPC_URL=https://rpc.xlayer.tech

# ── Deployed Contract Addresses ────────────────
NEXT_PUBLIC_VAULTMIND_CORE_ADDRESS=0x...
NEXT_PUBLIC_FLASH_RESCUE_ADDRESS=0x...
NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS=0x...
```

### Run

```bash
npm run dev
# Dashboard available at → http://localhost:3000
```

### Build for Production

```bash
npm run build
npm start
# Or deploy to Vercel: vercel --prod
```

---

## Contract Addresses (X Layer Mainnet — Chain ID 196)

> Update this table after deployment.

| Contract | Address | Purpose |
|----------|---------|---------|
| `VaultMindCore` | `0xDDc90434a8DD095ac6B5046fFbC4BD5d5f477306` | Access control & delegate mapping |
| `FlashRescue` | `0x1e6955512b94a8CECbD28781c00B4930900f5147` | Aave V3 liquidation prevention |
| `LiquidityManager` | `0x2AF9F9314ADbd03811EE8Fd71087f92cba6341b7` | Uniswap V3 LP rebalancing |
| Aave V3 Hub (Pool) | `0x061D8E131F26512348ee5FA42e2DF1ba9D6505e9` | Lending protocol |
| Aave Addresses Provider | `0xdFf435BCcf782f11187D3a4454D96702eD78e092` | Registry proxy |
| Uniswap V3 Pos. Manager | `0x315e413A11AB0df498eF83873012430ca36638Ae` | LP NFT management |
| OKX DEX Router | `0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954` | Swap aggregator |

---

## OnchainOS CLI Setup

The agent node requires the **OKX OnchainOS CLI** to be installed and authenticated:

```bash
# Install OnchainOS CLI
npm install -g @aspect-build/onchainos

# Authenticate
onchainos login

# Verify available skills
onchainos skills list
```

Required skills:
- `okx-defi-portfolio` — wallet position monitoring
- `okx-onchain-gateway` — pre-execution simulation
- `okx-defi-invest` — DeFi actions
- `okx-security` — token risk analysis

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| `forge install` fails | Run `forge install --no-commit` if in a git repo |
| RPC rate limiting | The agent uses a 400ms delay between calls; switch to a dedicated RPC if needed |
| Tests fail on `calculateOptimalRepayment` | Ensure `MockOracle` is deployed in test setup (returns 1e8 for USD-pegged assets) |
| Frontend wallet connection fails | Ensure MetaMask has X Layer network added (Chain ID: 196, RPC: `https://rpc.xlayer.tech`) |
| Agent drops all transactions | Check OnchainOS Gateway simulation — this is expected fail-closed behavior when simulation detects issues |

---

## Development Workflow

```bash
# Run everything from the project root:

# Terminal 1 — Smart contract tests (watch mode)
cd contracts && forge test --watch

# Terminal 2 — Agent node
cd agent-node && npm run dev

# Terminal 3 — Frontend
cd frontend && npm run dev
```

---

<p align="center">
  <sub>VaultMind — OKX Build X Hackathon · X Layer Arena</sub>
</p>
