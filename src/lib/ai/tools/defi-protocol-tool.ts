/**
 * DEFI-PROTOCOL TOOL
 * Comprehensive DeFi protocol simulation and analysis
 *
 * Provides:
 * - Automated Market Maker (AMM) swap calculations
 * - Liquidity pool analysis and provisioning
 * - Yield farming strategy evaluation
 * - Flash loan mechanics
 * - Impermanent loss calculation
 * - Protocol comparisons (Uniswap, Aave, Compound, Curve)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// PROTOCOL CONFIGURATIONS
// ============================================================================

interface ProtocolConfig {
  name: string;
  type: 'amm' | 'lending' | 'yield_aggregator';
  swapFee: number;
  formula: string;
  flashLoanFee: number;
  description: string;
  tvlEstimate: number;
}

const PROTOCOLS: Record<string, ProtocolConfig> = {
  uniswap_v2: {
    name: 'Uniswap V2',
    type: 'amm',
    swapFee: 0.003,
    formula: 'x * y = k (Constant Product)',
    flashLoanFee: 0.0009,
    description: 'Constant product AMM with equal-weight liquidity pools',
    tvlEstimate: 4_000_000_000
  },
  uniswap_v3: {
    name: 'Uniswap V3',
    type: 'amm',
    swapFee: 0.003,
    formula: 'Concentrated liquidity with price ranges',
    flashLoanFee: 0,
    description: 'Concentrated liquidity AMM with capital efficiency',
    tvlEstimate: 5_000_000_000
  },
  curve: {
    name: 'Curve Finance',
    type: 'amm',
    swapFee: 0.0004,
    formula: 'StableSwap invariant (hybrid constant sum/product)',
    flashLoanFee: 0,
    description: 'Optimized for stablecoin and pegged asset swaps',
    tvlEstimate: 3_000_000_000
  },
  aave_v3: {
    name: 'Aave V3',
    type: 'lending',
    swapFee: 0,
    formula: 'Variable/Stable interest rate model',
    flashLoanFee: 0.0005,
    description: 'Decentralized lending protocol with flash loans',
    tvlEstimate: 10_000_000_000
  },
  compound: {
    name: 'Compound',
    type: 'lending',
    swapFee: 0,
    formula: 'Interest rate model based on utilization',
    flashLoanFee: 0,
    description: 'Algorithmic money market protocol',
    tvlEstimate: 2_500_000_000
  },
  balancer: {
    name: 'Balancer',
    type: 'amm',
    swapFee: 0.002,
    formula: 'Weighted constant product (multi-asset pools)',
    flashLoanFee: 0,
    description: 'Multi-token pools with custom weights',
    tvlEstimate: 1_500_000_000
  }
};

// ============================================================================
// TOKEN DATA (Example tokens for calculations)
// ============================================================================

interface Token {
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number;
  category: 'stable' | 'major' | 'defi' | 'meme';
}

const TOKENS: Record<string, Token> = {
  ETH: { symbol: 'ETH', name: 'Ethereum', decimals: 18, priceUsd: 2000, category: 'major' },
  WETH: { symbol: 'WETH', name: 'Wrapped Ethereum', decimals: 18, priceUsd: 2000, category: 'major' },
  USDC: { symbol: 'USDC', name: 'USD Coin', decimals: 6, priceUsd: 1.0, category: 'stable' },
  USDT: { symbol: 'USDT', name: 'Tether', decimals: 6, priceUsd: 1.0, category: 'stable' },
  DAI: { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, priceUsd: 1.0, category: 'stable' },
  WBTC: { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, priceUsd: 40000, category: 'major' },
  UNI: { symbol: 'UNI', name: 'Uniswap', decimals: 18, priceUsd: 7.5, category: 'defi' },
  AAVE: { symbol: 'AAVE', name: 'Aave', decimals: 18, priceUsd: 90, category: 'defi' },
  CRV: { symbol: 'CRV', name: 'Curve DAO Token', decimals: 18, priceUsd: 0.5, category: 'defi' },
  LINK: { symbol: 'LINK', name: 'Chainlink', decimals: 18, priceUsd: 15, category: 'defi' }
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const defiprotocolTool: UnifiedTool = {
  name: 'defi_protocol',
  description: 'Comprehensive DeFi protocol simulation and analysis tool. Supports AMM swaps, liquidity pools, yield farming, flash loans, and impermanent loss calculations for major protocols.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['amm_swap', 'liquidity_pool', 'yield_farm', 'flash_loan', 'impermanent_loss', 'lending', 'compare', 'info', 'examples'],
        description: 'Operation to perform'
      },
      protocol: {
        type: 'string',
        enum: ['uniswap_v2', 'uniswap_v3', 'curve', 'aave_v3', 'compound', 'balancer'],
        description: 'DeFi protocol to use'
      },
      // For amm_swap
      token_in: { type: 'string', description: 'Token symbol to swap from (e.g., ETH)' },
      token_out: { type: 'string', description: 'Token symbol to swap to (e.g., USDC)' },
      amount_in: { type: 'number', description: 'Amount of token_in to swap' },
      reserve_in: { type: 'number', description: 'Pool reserve of token_in' },
      reserve_out: { type: 'number', description: 'Pool reserve of token_out' },
      // For liquidity_pool
      token_a: { type: 'string', description: 'First token in pair' },
      token_b: { type: 'string', description: 'Second token in pair' },
      amount_a: { type: 'number', description: 'Amount of token A to deposit' },
      amount_b: { type: 'number', description: 'Amount of token B to deposit' },
      pool_share: { type: 'number', description: 'Share of pool (for withdrawal)' },
      total_pool_value: { type: 'number', description: 'Total pool value in USD' },
      // For yield_farm
      principal: { type: 'number', description: 'Principal investment in USD' },
      apy: { type: 'number', description: 'Annual percentage yield (as decimal, e.g., 0.1 for 10%)' },
      duration_days: { type: 'number', description: 'Investment duration in days' },
      compound_frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'none'], description: 'Compounding frequency' },
      // For flash_loan
      loan_amount: { type: 'number', description: 'Flash loan amount in USD' },
      // For impermanent_loss
      initial_price_ratio: { type: 'number', description: 'Initial price ratio (token_a/token_b)' },
      current_price_ratio: { type: 'number', description: 'Current price ratio (token_a/token_b)' },
      // For lending
      collateral_amount: { type: 'number', description: 'Collateral amount in USD' },
      collateral_factor: { type: 'number', description: 'Loan-to-value ratio (e.g., 0.75)' },
      borrow_apy: { type: 'number', description: 'Borrowing APY' },
      supply_apy: { type: 'number', description: 'Supply APY' }
    },
    required: ['operation']
  }
};

// ============================================================================
// AMM CALCULATIONS
// ============================================================================

function calculateAmmSwap(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  fee: number = 0.003
): {
  amount_out: number;
  price_impact: number;
  effective_price: number;
  fee_paid: number;
  new_reserve_in: number;
  new_reserve_out: number;
  k_before: number;
  k_after: number;
} {
  // Apply fee
  const amountInWithFee = amountIn * (1 - fee);
  const feePaid = amountIn * fee;

  // Constant product formula: x * y = k
  // amountOut = reserveOut - k / (reserveIn + amountInWithFee)
  const k = reserveIn * reserveOut;
  const newReserveIn = reserveIn + amountInWithFee;
  const newReserveOut = k / newReserveIn;
  const amountOut = reserveOut - newReserveOut;

  // Price impact calculation
  const spotPrice = reserveOut / reserveIn;
  const effectivePrice = amountOut / amountIn;
  const priceImpact = Math.abs(1 - effectivePrice / spotPrice);

  return {
    amount_out: amountOut,
    price_impact: priceImpact,
    effective_price: effectivePrice,
    fee_paid: feePaid,
    new_reserve_in: newReserveIn,
    new_reserve_out: newReserveOut,
    k_before: k,
    k_after: newReserveIn * newReserveOut
  };
}

function calculateStableSwap(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  A: number = 100 // Amplification coefficient
): {
  amount_out: number;
  price_impact: number;
  effective_price: number;
} {
  // Simplified StableSwap (Curve) calculation
  // For stablecoins, uses hybrid invariant for lower slippage

  const n = 2; // Number of tokens
  const D = reserveIn + reserveOut; // Simplified D calculation

  // Newton-Raphson approximation for y (simplified)
  const xNew = reserveIn + amountIn;
  const S = xNew;
  const Ann = A * n;

  // Simplified calculation - actual Curve uses iterative method
  const c = D * D / (n * xNew);
  const b = S + D / Ann;
  let y = D;

  // Few iterations of Newton's method
  for (let i = 0; i < 10; i++) {
    const yPrev = y;
    y = (y * y + c) / (2 * y + b - D);
    if (Math.abs(y - yPrev) < 1) break;
  }

  const amountOut = reserveOut - y;

  return {
    amount_out: amountOut > 0 ? amountOut : reserveOut * 0.99,
    price_impact: Math.abs(amountIn - amountOut) / amountIn,
    effective_price: amountOut / amountIn
  };
}

// ============================================================================
// LIQUIDITY POOL CALCULATIONS
// ============================================================================

function calculateLiquidityProvision(
  amountA: number,
  amountB: number,
  priceA: number,
  priceB: number,
  totalPoolValue: number
): {
  value_deposited: number;
  pool_share: number;
  lp_tokens_received: number;
  value_each_side: number;
  optimal_ratio: number;
  current_ratio: number;
  is_balanced: boolean;
} {
  const valueA = amountA * priceA;
  const valueB = amountB * priceB;
  const totalDeposited = valueA + valueB;

  // For 50/50 pool, should be balanced
  const optimalRatio = 0.5;
  const actualRatio = valueA / totalDeposited;
  const isBalanced = Math.abs(actualRatio - optimalRatio) < 0.05;

  // LP tokens proportional to contribution
  const poolShare = totalPoolValue > 0 ? totalDeposited / (totalPoolValue + totalDeposited) : 1;
  const lpTokens = poolShare * 1000; // Arbitrary LP token amount

  return {
    value_deposited: totalDeposited,
    pool_share: poolShare,
    lp_tokens_received: lpTokens,
    value_each_side: totalDeposited / 2,
    optimal_ratio: optimalRatio,
    current_ratio: actualRatio,
    is_balanced: isBalanced
  };
}

// ============================================================================
// IMPERMANENT LOSS CALCULATION
// ============================================================================

function calculateImpermanentLoss(initialRatio: number, currentRatio: number): {
  price_change_ratio: number;
  impermanent_loss_percent: number;
  il_vs_hold: string;
  breakeven_fees_needed: number;
  analysis: string;
} {
  // IL formula: IL = 2 * sqrt(r) / (1 + r) - 1
  // where r = currentRatio / initialRatio
  const r = currentRatio / initialRatio;
  const sqrtR = Math.sqrt(r);
  const ilValue = 2 * sqrtR / (1 + r) - 1;
  const ilPercent = Math.abs(ilValue) * 100;

  // Analysis
  let analysis: string;
  if (ilPercent < 1) {
    analysis = 'Minimal IL - pool position performing similarly to holding';
  } else if (ilPercent < 5) {
    analysis = 'Moderate IL - typical for volatile pairs, fees may compensate';
  } else if (ilPercent < 25) {
    analysis = 'Significant IL - need substantial fee income to offset';
  } else {
    analysis = 'Severe IL - consider exiting position or rebalancing';
  }

  return {
    price_change_ratio: r,
    impermanent_loss_percent: ilPercent,
    il_vs_hold: `Pool position is ${ilPercent.toFixed(2)}% less valuable than holding`,
    breakeven_fees_needed: ilPercent,
    analysis
  };
}

// ============================================================================
// YIELD FARMING CALCULATIONS
// ============================================================================

function calculateYieldFarming(
  principal: number,
  apy: number,
  durationDays: number,
  compoundFrequency: string
): {
  principal: number;
  apy_percent: number;
  duration_days: number;
  compound_frequency: string;
  final_value: number;
  total_yield: number;
  effective_apr: number;
  daily_yield: number;
  compound_periods: number;
  comparison: {
    no_compound: number;
    daily_compound: number;
    difference: number;
  };
} {
  const years = durationDays / 365;

  // Compound periods per year
  const periodsPerYear: Record<string, number> = {
    daily: 365,
    weekly: 52,
    monthly: 12,
    none: 1
  };

  const n = periodsPerYear[compoundFrequency] || 365;
  const compoundPeriods = Math.floor(n * years);

  // Compound interest formula: A = P(1 + r/n)^(nt)
  let finalValue: number;
  if (compoundFrequency === 'none') {
    finalValue = principal * (1 + apy * years);
  } else {
    finalValue = principal * Math.pow(1 + apy / n, n * years);
  }

  const totalYield = finalValue - principal;

  // Compare with no compounding and daily compounding
  const noCompound = principal * (1 + apy * years);
  const dailyCompound = principal * Math.pow(1 + apy / 365, 365 * years);

  return {
    principal,
    apy_percent: apy * 100,
    duration_days: durationDays,
    compound_frequency: compoundFrequency,
    final_value: finalValue,
    total_yield: totalYield,
    effective_apr: (totalYield / principal / years) * 100,
    daily_yield: totalYield / durationDays,
    compound_periods: compoundPeriods,
    comparison: {
      no_compound: noCompound,
      daily_compound: dailyCompound,
      difference: dailyCompound - noCompound
    }
  };
}

// ============================================================================
// FLASH LOAN CALCULATIONS
// ============================================================================

function calculateFlashLoan(
  amount: number,
  protocol: string
): {
  loan_amount: number;
  protocol: string;
  fee_percent: number;
  fee_amount: number;
  amount_to_repay: number;
  typical_use_cases: string[];
  arbitrage_profit_needed: number;
  risks: string[];
  gas_estimate_usd: number;
} {
  const protocolConfig = PROTOCOLS[protocol] || PROTOCOLS.aave_v3;
  const feePercent = protocolConfig.flashLoanFee;
  const feeAmount = amount * feePercent;
  const repayAmount = amount + feeAmount;

  // Estimate gas (simplified)
  const gasEstimate = 50; // Base gas cost in USD

  return {
    loan_amount: amount,
    protocol: protocolConfig.name,
    fee_percent: feePercent * 100,
    fee_amount: feeAmount,
    amount_to_repay: repayAmount,
    typical_use_cases: [
      'DEX arbitrage between Uniswap and Sushiswap',
      'Liquidation of undercollateralized positions',
      'Collateral swap without closing position',
      'Self-liquidation to avoid penalties',
      'One-transaction leverage'
    ],
    arbitrage_profit_needed: feeAmount + gasEstimate,
    risks: [
      'Transaction must complete atomically',
      'High gas costs during congestion',
      'MEV bots may frontrun',
      'Smart contract bugs'
    ],
    gas_estimate_usd: gasEstimate
  };
}

// ============================================================================
// LENDING CALCULATIONS
// ============================================================================

function calculateLending(
  collateralAmount: number,
  collateralFactor: number,
  borrowApy: number,
  supplyApy: number,
  durationDays: number
): {
  collateral_value: number;
  max_borrow: number;
  safe_borrow: number;
  health_factor_at_max: number;
  liquidation_threshold: number;
  supply_interest_earned: number;
  borrow_interest_owed: number;
  net_apy: number;
  leverage_possible: number;
  strategies: Array<{
    name: string;
    borrow_amount: number;
    health_factor: number;
    risk: string;
  }>;
} {
  const maxBorrow = collateralAmount * collateralFactor;
  const safeBorrow = maxBorrow * 0.6; // Conservative 60% of max

  // Health factor = (collateral * liquidation_threshold) / borrow
  const liquidationThreshold = collateralFactor * 1.1; // Typically slightly higher than LTV
  const healthAtMax = (collateralAmount * liquidationThreshold) / maxBorrow;

  // Interest calculations
  const years = durationDays / 365;
  const supplyInterest = collateralAmount * supplyApy * years;
  const borrowInterest = safeBorrow * borrowApy * years;
  const netApy = ((supplyInterest - borrowInterest) / collateralAmount) * 100 / years;

  // Max leverage = 1 / (1 - collateralFactor)
  const maxLeverage = 1 / (1 - collateralFactor);

  // Strategy suggestions
  const strategies = [
    {
      name: 'Conservative',
      borrow_amount: maxBorrow * 0.5,
      health_factor: 2.0,
      risk: 'Low - safe buffer from liquidation'
    },
    {
      name: 'Moderate',
      borrow_amount: maxBorrow * 0.7,
      health_factor: 1.43,
      risk: 'Medium - monitor regularly'
    },
    {
      name: 'Aggressive',
      borrow_amount: maxBorrow * 0.9,
      health_factor: 1.11,
      risk: 'High - close to liquidation'
    }
  ];

  return {
    collateral_value: collateralAmount,
    max_borrow: maxBorrow,
    safe_borrow: safeBorrow,
    health_factor_at_max: healthAtMax,
    liquidation_threshold: liquidationThreshold,
    supply_interest_earned: supplyInterest,
    borrow_interest_owed: borrowInterest,
    net_apy: netApy,
    leverage_possible: maxLeverage,
    strategies
  };
}

// ============================================================================
// PROTOCOL COMPARISON
// ============================================================================

function compareProtocols(): {
  amm_protocols: Array<{
    name: string;
    swap_fee: string;
    formula: string;
    best_for: string;
    tvl: string;
  }>;
  lending_protocols: Array<{
    name: string;
    flash_loan_fee: string;
    description: string;
    tvl: string;
  }>;
  recommendations: {
    stablecoin_swaps: string;
    volatile_pairs: string;
    lending: string;
    flash_loans: string;
  };
} {
  const ammProtocols = Object.entries(PROTOCOLS)
    .filter(([_, p]) => p.type === 'amm')
    .map(([key, p]) => ({
      name: p.name,
      swap_fee: `${(p.swapFee * 100).toFixed(2)}%`,
      formula: p.formula,
      best_for: key === 'curve' ? 'Stablecoin swaps' :
        key === 'balancer' ? 'Multi-asset portfolios' : 'General token swaps',
      tvl: `$${(p.tvlEstimate / 1e9).toFixed(1)}B`
    }));

  const lendingProtocols = Object.entries(PROTOCOLS)
    .filter(([_, p]) => p.type === 'lending')
    .map(([_, p]) => ({
      name: p.name,
      flash_loan_fee: `${(p.flashLoanFee * 100).toFixed(2)}%`,
      description: p.description,
      tvl: `$${(p.tvlEstimate / 1e9).toFixed(1)}B`
    }));

  return {
    amm_protocols: ammProtocols,
    lending_protocols: lendingProtocols,
    recommendations: {
      stablecoin_swaps: 'Curve Finance - lowest slippage for pegged assets',
      volatile_pairs: 'Uniswap V3 - concentrated liquidity for efficiency',
      lending: 'Aave V3 - most features, cross-chain, flash loans',
      flash_loans: 'Aave V3 - 0.05% fee, reliable execution'
    }
  };
}

function getInfo(): object {
  return {
    tool: 'defi_protocol',
    description: 'Comprehensive DeFi protocol simulation and analysis',
    capabilities: [
      'AMM swap calculations (constant product, StableSwap)',
      'Liquidity pool provisioning and LP token calculations',
      'Yield farming with compound interest',
      'Flash loan economics',
      'Impermanent loss analysis',
      'Lending protocol calculations',
      'Protocol comparison and recommendations'
    ],
    supported_protocols: Object.keys(PROTOCOLS),
    example_tokens: Object.keys(TOKENS),
    formulas: {
      constant_product: 'x * y = k (Uniswap V2)',
      stableswap: 'A*n^n * sum(x_i) + D = A*D*n^n + D^(n+1)/(n^n * prod(x_i))',
      impermanent_loss: 'IL = 2*sqrt(r)/(1+r) - 1 where r = price_ratio_change',
      compound_interest: 'A = P(1 + r/n)^(nt)',
      health_factor: 'HF = (collateral * liq_threshold) / debt'
    },
    risk_levels: {
      low: 'Health factor > 2.0, conservative positions',
      medium: 'Health factor 1.5-2.0, requires monitoring',
      high: 'Health factor < 1.5, liquidation risk'
    }
  };
}

function getExamples(): object {
  return {
    uniswap_swap: {
      operation: 'amm_swap',
      protocol: 'uniswap_v2',
      token_in: 'ETH',
      token_out: 'USDC',
      amount_in: 10,
      reserve_in: 5000,
      reserve_out: 10000000
    },
    provide_liquidity: {
      operation: 'liquidity_pool',
      token_a: 'ETH',
      token_b: 'USDC',
      amount_a: 5,
      amount_b: 10000,
      total_pool_value: 1000000
    },
    yield_farming: {
      operation: 'yield_farm',
      principal: 10000,
      apy: 0.20,
      duration_days: 365,
      compound_frequency: 'daily'
    },
    impermanent_loss: {
      operation: 'impermanent_loss',
      initial_price_ratio: 2000,
      current_price_ratio: 3000
    },
    flash_loan: {
      operation: 'flash_loan',
      protocol: 'aave_v3',
      loan_amount: 1000000
    },
    lending: {
      operation: 'lending',
      collateral_amount: 100000,
      collateral_factor: 0.75,
      borrow_apy: 0.05,
      supply_apy: 0.02,
      duration_days: 365
    }
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executedefiprotocol(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const protocol = args.protocol || 'uniswap_v2';

    let result: object;

    switch (operation) {
      case 'amm_swap': {
        if (!args.amount_in || !args.reserve_in || !args.reserve_out) {
          throw new Error('amount_in, reserve_in, and reserve_out required');
        }
        const protocolConfig = PROTOCOLS[protocol] || PROTOCOLS.uniswap_v2;

        let swapResult;
        if (protocol === 'curve') {
          swapResult = calculateStableSwap(args.amount_in, args.reserve_in, args.reserve_out);
        } else {
          swapResult = calculateAmmSwap(
            args.amount_in,
            args.reserve_in,
            args.reserve_out,
            protocolConfig.swapFee
          );
        }

        result = {
          operation: 'amm_swap',
          protocol: protocolConfig.name,
          input: {
            token_in: args.token_in || 'TOKEN_A',
            token_out: args.token_out || 'TOKEN_B',
            amount_in: args.amount_in,
            reserve_in: args.reserve_in,
            reserve_out: args.reserve_out
          },
          ...swapResult
        };
        break;
      }

      case 'liquidity_pool': {
        const priceA = TOKENS[args.token_a]?.priceUsd || 1;
        const priceB = TOKENS[args.token_b]?.priceUsd || 1;

        result = {
          operation: 'liquidity_pool',
          tokens: {
            token_a: args.token_a || 'TOKEN_A',
            token_b: args.token_b || 'TOKEN_B',
            amount_a: args.amount_a || 0,
            amount_b: args.amount_b || 0,
            price_a: priceA,
            price_b: priceB
          },
          ...calculateLiquidityProvision(
            args.amount_a || 0,
            args.amount_b || 0,
            priceA,
            priceB,
            args.total_pool_value || 0
          )
        };
        break;
      }

      case 'yield_farm':
        if (!args.principal || !args.apy) {
          throw new Error('principal and apy required');
        }
        result = {
          operation: 'yield_farm',
          ...calculateYieldFarming(
            args.principal,
            args.apy,
            args.duration_days || 365,
            args.compound_frequency || 'daily'
          )
        };
        break;

      case 'flash_loan':
        if (!args.loan_amount) {
          throw new Error('loan_amount required');
        }
        result = {
          operation: 'flash_loan',
          ...calculateFlashLoan(args.loan_amount, protocol)
        };
        break;

      case 'impermanent_loss':
        if (!args.initial_price_ratio || !args.current_price_ratio) {
          throw new Error('initial_price_ratio and current_price_ratio required');
        }
        result = {
          operation: 'impermanent_loss',
          ...calculateImpermanentLoss(args.initial_price_ratio, args.current_price_ratio)
        };
        break;

      case 'lending':
        if (!args.collateral_amount) {
          throw new Error('collateral_amount required');
        }
        result = {
          operation: 'lending',
          ...calculateLending(
            args.collateral_amount,
            args.collateral_factor || 0.75,
            args.borrow_apy || 0.05,
            args.supply_apy || 0.02,
            args.duration_days || 365
          )
        };
        break;

      case 'compare':
        result = {
          operation: 'compare',
          ...compareProtocols()
        };
        break;

      case 'examples':
        result = {
          operation: 'examples',
          examples: getExamples()
        };
        break;

      case 'info':
      default:
        result = {
          operation: 'info',
          ...getInfo()
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isdefiprotocolAvailable(): boolean {
  return true;
}
