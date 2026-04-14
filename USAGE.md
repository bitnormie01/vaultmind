# VaultMind — Usage & Integration Guide

Welcome to **VaultMind**! This guide is designed for users, developers, and hackathon judges to easily understand how to interact with, test, and integrate the VaultMind autonomous agent and its smart contracts on **X Layer**.

---

## 1. Using the Dashboard (For Users & Judges)

The VaultMind Frontend provides a real-time, glassmorphic overview of all your protected DeFi positions. 

### Accessing the Dashboard
1. Ensure the frontend is running (`npm run dev` in the `frontend` directory).
2. Navigate to `http://localhost:3000` (or `http://localhost:3001` if port 3000 is taken).
3. **Connect OKX Wallet**: Click the **Connect OKX Wallet** button in the top right. 
4. **Switch to X Layer**: Ensure your wallet network is set to X Layer Mainnet (Chain ID `196`).

### What to Look For
- **Aave V3 Safety Engine**: Displays your live Health Factor, Collateral, and Debt. If your Health Factor drops below the safety threshold (e.g., `< 1.3`), you will see an "At Risk" warning and the optimal repayment calculation.
- **Uniswap V3 Positions**: Displays your concentrated liquidity positions and visualizes whether they are currently "In Range" or "Out of Range".
- **Live Metrics & Execution Log**: Once the VaultMind `agent-node` is running, these panels will switch from "Demo Mode" to "LIVE", streaming real-time heartbeat checks, simulation results, and execution logs from your agent.

---

## 2. Deploying Your Own Agent Node (For Advanced Users)

VaultMind leverages an off-chain TypeScript agent powered by **OKX OnchainOS** to monitor and execute transactions using a secure TEE Agentic Wallet.

### Configuration
In the `agent-node/` directory, ensure your `.env` is configured properly. You can dictate the exact parameters of your protection:

```env
# Agent Protection Parameters
POLL_INTERVAL_MS=12000       # How often the agent checks your positions (ms)
HF_THRESHOLD=1.3             # Health Factor trigger point for flash rescues
TARGET_HF=1.5                # Health factor the agent will restore the position to
MAX_SLIPPAGE_BPS=100         # Maximum slippage allowed (1%) on OKX DEX swaps
```

### Starting the Agent
```bash
cd agent-node
npm run dev
```
Once started, the agent will poll your positions every cycle. If it detects a risky position (e.g. HF drops below `1.3`), it will automatically formulate a flash loan rescue transaction, simulate it via `okx-onchain-gateway`, and execute it.

---

## 3. How to Test the Automated Triggers (For Judges)

To observe VaultMind's fail-closed security and execution loops during the hackathon evaluation, you can follow these steps:

### Testing Application Connections:
1. **Monitor State**: Start the `agent-node` and the `frontend` dashboard simultaneously. 
2. **Observe the Sync**: You will instantly see the Dashboard's "Execution Log" start receiving data from the agent-node via the local API proxy.
3. **Intentional Revert (Fail-Closed testing)**: You can temporarily edit the `HF_THRESHOLD` to a massive number (e.g., `100.0`) to force the agent to attempt a rescue.
4. **Watch the Simulation Drop**: Observe the agent terminal and the Frontend Execution Log. You will see the `okx-onchain-gateway` intercept the transaction and **DROP** it because it realizes the math doesn't require a liquidation rescue, printing a *Fail-Closed Simulation* warning. This proves zero funds are ever risked on bad logic.

---

## 4. Smart Contract Integration (For Developers)

If you are a developer looking to integrate VaultMind's execution engine directly into your protocols or yield aggregators, you can interface with our core contracts on X Layer.

### Aave V3 Flash Rescue execution
```solidity
// Interface instance pointing to VaultMind's FlashRescue contract
IFlashRescue vaultMindRescue = IFlashRescue(0x1e6955512b94a8CECbD28781c00B4930900f5147);

// Retrieve a user's required optimal repayment to reach the safe target HF
uint256 optimalRepay = vaultMindRescue.calculateOptimalRepayment(userAddress, USDC_ADDRESS);

// Execute Rescue (Must be called by a delegate or the agent node)
vaultMindRescue.executeRescue(
    IFlashRescue.RescueParams({
        userWallet: userAddress,
        debtAsset: USDC_ADDRESS,
        collateralAsset: WOKB_ADDRESS,
        debtToRepay: optimalRepay
    })
);
```

### Uniswap V3 LP Rebalancing
```solidity
ILiquidityManager lpManager = ILiquidityManager(0x2AF9F9314ADbd03811EE8Fd71087f92cba6341b7);

// Agent supplies new optimal ticks based on current pool price
lpManager.rebalancePosition(
    ILiquidityManager.RebalanceParams({
        userWallet: userAddress,
        tokenId: 42391,
        newTickLower: -74000,
        newTickUpper: -71000
    })
);
```

---

## Need Support?
For any detailed questions during the BuildX Hackathon evaluation, please open an Issue in this repository, check the `LIVE_FIRE_LOG.txt` for mainnet proof of work, or reach out to the developer directly.
