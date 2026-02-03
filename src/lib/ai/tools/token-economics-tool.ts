/**
 * TOKEN-ECONOMICS TOOL
 * Comprehensive tokenomics analysis and design
 * Supply curves, vesting schedules, inflation models, distribution analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Token distribution categories
interface AllocationCategory {
  name: string;
  percentage: number;
  vestingMonths: number;
  cliffMonths: number;
  description: string;
}

// Standard token allocation templates
const ALLOCATION_TEMPLATES: Record<string, AllocationCategory[]> = {
  defi_protocol: [
    {
      name: 'Community Treasury',
      percentage: 40,
      vestingMonths: 48,
      cliffMonths: 0,
      description: 'DAO-controlled community funds',
    },
    {
      name: 'Team & Advisors',
      percentage: 20,
      vestingMonths: 36,
      cliffMonths: 12,
      description: 'Core team with cliff',
    },
    {
      name: 'Investors',
      percentage: 15,
      vestingMonths: 24,
      cliffMonths: 6,
      description: 'Seed and strategic investors',
    },
    {
      name: 'Liquidity Mining',
      percentage: 15,
      vestingMonths: 36,
      cliffMonths: 0,
      description: 'Protocol incentives',
    },
    {
      name: 'Ecosystem Fund',
      percentage: 10,
      vestingMonths: 48,
      cliffMonths: 0,
      description: 'Grants and partnerships',
    },
  ],
  layer1_blockchain: [
    {
      name: 'Public Sale',
      percentage: 25,
      vestingMonths: 12,
      cliffMonths: 0,
      description: 'TGE with gradual unlock',
    },
    {
      name: 'Foundation',
      percentage: 20,
      vestingMonths: 60,
      cliffMonths: 12,
      description: 'Long-term development',
    },
    {
      name: 'Team',
      percentage: 15,
      vestingMonths: 48,
      cliffMonths: 12,
      description: 'Core contributors',
    },
    {
      name: 'Validators/Staking',
      percentage: 20,
      vestingMonths: 0,
      cliffMonths: 0,
      description: 'Staking rewards pool',
    },
    {
      name: 'Private Sale',
      percentage: 12,
      vestingMonths: 18,
      cliffMonths: 6,
      description: 'Early investors',
    },
    {
      name: 'Advisors',
      percentage: 5,
      vestingMonths: 24,
      cliffMonths: 6,
      description: 'Strategic advisors',
    },
    {
      name: 'Marketing',
      percentage: 3,
      vestingMonths: 36,
      cliffMonths: 0,
      description: 'Growth initiatives',
    },
  ],
  nft_gaming: [
    {
      name: 'Play-to-Earn',
      percentage: 35,
      vestingMonths: 60,
      cliffMonths: 0,
      description: 'In-game rewards',
    },
    {
      name: 'Ecosystem',
      percentage: 20,
      vestingMonths: 48,
      cliffMonths: 0,
      description: 'Developer grants',
    },
    { name: 'Team', percentage: 15, vestingMonths: 36, cliffMonths: 12, description: 'Core team' },
    {
      name: 'Private Sale',
      percentage: 10,
      vestingMonths: 18,
      cliffMonths: 3,
      description: 'Early backers',
    },
    {
      name: 'Public Sale',
      percentage: 10,
      vestingMonths: 6,
      cliffMonths: 0,
      description: 'Community sale',
    },
    {
      name: 'Liquidity',
      percentage: 5,
      vestingMonths: 0,
      cliffMonths: 0,
      description: 'DEX liquidity',
    },
    {
      name: 'Advisors',
      percentage: 5,
      vestingMonths: 24,
      cliffMonths: 6,
      description: 'Industry advisors',
    },
  ],
  dao_governance: [
    {
      name: 'Treasury',
      percentage: 50,
      vestingMonths: 0,
      cliffMonths: 0,
      description: 'DAO-controlled',
    },
    {
      name: 'Retroactive Airdrop',
      percentage: 20,
      vestingMonths: 12,
      cliffMonths: 0,
      description: 'Early users',
    },
    {
      name: 'Core Contributors',
      percentage: 15,
      vestingMonths: 48,
      cliffMonths: 12,
      description: 'Initial team',
    },
    {
      name: 'Strategic Partners',
      percentage: 10,
      vestingMonths: 24,
      cliffMonths: 6,
      description: 'Ecosystem partners',
    },
    {
      name: 'Advisors',
      percentage: 5,
      vestingMonths: 24,
      cliffMonths: 6,
      description: 'Strategic advisors',
    },
  ],
};

// Inflation model types
const INFLATION_MODELS: Record<
  string,
  {
    description: string;
    formula: string;
    parameters: string[];
  }
> = {
  fixed: {
    description: 'Constant inflation rate each period',
    formula: 'supply(t) = supply(0) * (1 + r)^t',
    parameters: ['annual_rate'],
  },
  decreasing: {
    description: 'Halving or decreasing schedule (Bitcoin-style)',
    formula: 'reward(t) = initial_reward / 2^floor(t/halving_period)',
    parameters: ['initial_reward', 'halving_period'],
  },
  asymptotic: {
    description: 'Approaches max supply asymptotically',
    formula: 'supply(t) = max_supply * (1 - e^(-k*t))',
    parameters: ['max_supply', 'k_rate'],
  },
  dynamic: {
    description: 'Adjusts based on staking ratio or other metrics',
    formula: 'inflation = base_rate * (1 - staking_ratio / target_ratio)',
    parameters: ['base_rate', 'target_staking_ratio'],
  },
  deflationary: {
    description: 'Burns exceed emissions, net negative inflation',
    formula: 'supply(t) = supply(t-1) + emissions - burns',
    parameters: ['burn_rate', 'emission_rate'],
  },
};

// Token velocity benchmarks by sector
const VELOCITY_BENCHMARKS: Record<string, { low: number; median: number; high: number }> = {
  currency: { low: 4, median: 6, high: 12 },
  defi: { low: 10, median: 25, high: 50 },
  governance: { low: 0.5, median: 2, high: 5 },
  utility: { low: 8, median: 15, high: 30 },
  store_of_value: { low: 0.2, median: 1, high: 3 },
  gaming: { low: 15, median: 40, high: 100 },
};

// Vesting schedule types
type VestingType = 'linear' | 'cliff_then_linear' | 'milestone' | 'exponential' | 'step';

export const tokeneconomicsTool: UnifiedTool = {
  name: 'token_economics',
  description:
    'Comprehensive tokenomics analysis - supply curves, vesting schedules, inflation models, distribution analysis, token velocity, and valuation models',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'supply_analysis',
          'vesting_schedule',
          'inflation_model',
          'distribution',
          'token_velocity',
          'valuation',
          'unlock_calendar',
          'staking_economics',
          'info',
          'examples',
        ],
        description: 'Operation type',
      },
      // Supply analysis
      initial_supply: { type: 'number', description: 'Initial token supply at launch' },
      max_supply: { type: 'number', description: 'Maximum token supply cap' },
      current_supply: { type: 'number', description: 'Current circulating supply' },

      // Vesting parameters
      vesting_type: {
        type: 'string',
        enum: ['linear', 'cliff_then_linear', 'milestone', 'exponential', 'step'],
        description: 'Vesting schedule type',
      },
      total_tokens: { type: 'number', description: 'Total tokens in vesting' },
      vesting_months: { type: 'number', description: 'Total vesting period in months' },
      cliff_months: { type: 'number', description: 'Cliff period before vesting starts' },
      tge_percentage: { type: 'number', description: 'Token Generation Event unlock percentage' },

      // Inflation model
      model_type: {
        type: 'string',
        enum: ['fixed', 'decreasing', 'asymptotic', 'dynamic', 'deflationary'],
        description: 'Inflation model type',
      },
      annual_rate: { type: 'number', description: 'Annual inflation rate (decimal)' },
      halving_period: { type: 'number', description: 'Halving period in years' },
      initial_reward: { type: 'number', description: 'Initial block/epoch reward' },
      burn_rate: { type: 'number', description: 'Annual burn rate (decimal)' },

      // Distribution
      template: {
        type: 'string',
        enum: ['defi_protocol', 'layer1_blockchain', 'nft_gaming', 'dao_governance', 'custom'],
        description: 'Distribution template',
      },
      allocations: { type: 'array', description: 'Custom allocation categories' },

      // Velocity and valuation
      sector: {
        type: 'string',
        enum: ['currency', 'defi', 'governance', 'utility', 'store_of_value', 'gaming'],
        description: 'Token sector',
      },
      gdp: { type: 'number', description: 'Economic value (GDP) flowing through token' },

      // Staking
      staking_apy: { type: 'number', description: 'Staking APY (decimal)' },
      staking_ratio: { type: 'number', description: 'Percentage of supply staked (decimal)' },
      lock_period_days: { type: 'number', description: 'Staking lock period in days' },

      // Time parameters
      years: { type: 'number', description: 'Number of years to project' },
      price: { type: 'number', description: 'Current token price in USD' },
    },
    required: ['operation'],
  },
};

export async function executetokeneconomics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'supply_analysis':
        result = analyzeSupply(args);
        break;

      case 'vesting_schedule':
        result = generateVestingSchedule(args);
        break;

      case 'inflation_model':
        result = modelInflation(args);
        break;

      case 'distribution':
        result = analyzeDistribution(args);
        break;

      case 'token_velocity':
        result = analyzeVelocity(args);
        break;

      case 'valuation':
        result = calculateValuation(args);
        break;

      case 'unlock_calendar':
        result = generateUnlockCalendar(args);
        break;

      case 'staking_economics':
        result = analyzeStakingEconomics(args);
        break;

      case 'examples':
        result = getExamples();
        break;

      case 'info':
      default:
        result = getInfo();
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function analyzeSupply(args: Record<string, unknown>): Record<string, unknown> {
  const initialSupply = (args.initial_supply as number) || 1_000_000_000;
  const maxSupply = (args.max_supply as number) || 1_000_000_000;
  const currentSupply = (args.current_supply as number) || initialSupply;
  const years = (args.years as number) || 10;
  const price = (args.price as number) || 1;

  // Calculate supply metrics
  const circulatingRatio = currentSupply / maxSupply;
  const remainingToMint = maxSupply - currentSupply;
  const fullyDilutedValue = maxSupply * price;
  const marketCap = currentSupply * price;
  const fdvToMcapRatio = fullyDilutedValue / marketCap;

  // Project supply over time (assuming linear release of remaining)
  const supplyProjection: {
    year: number;
    supply: number;
    percentOfMax: number;
    marketCap: number;
  }[] = [];
  const annualRelease = remainingToMint / years;

  for (let year = 0; year <= years; year++) {
    const projectedSupply = Math.min(currentSupply + annualRelease * year, maxSupply);
    supplyProjection.push({
      year,
      supply: Math.round(projectedSupply),
      percentOfMax: (projectedSupply / maxSupply) * 100,
      marketCap: projectedSupply * price,
    });
  }

  // Supply concentration analysis
  const dilutionImpact = calculateDilutionImpact(currentSupply, maxSupply);

  return {
    operation: 'supply_analysis',
    metrics: {
      initial_supply: initialSupply,
      current_circulating: currentSupply,
      max_supply: maxSupply,
      remaining_to_mint: remainingToMint,
      circulating_ratio: (circulatingRatio * 100).toFixed(2) + '%',
    },
    valuation: {
      price_usd: price,
      market_cap_usd: marketCap,
      fully_diluted_value_usd: fullyDilutedValue,
      fdv_to_mcap_ratio: fdvToMcapRatio.toFixed(2) + 'x',
    },
    supply_projection: supplyProjection,
    dilution_analysis: dilutionImpact,
    risk_assessment: assessSupplyRisk(circulatingRatio, fdvToMcapRatio),
  };
}

function calculateDilutionImpact(current: number, max: number): Record<string, unknown> {
  const remainingPercent = ((max - current) / current) * 100;
  const dilutionPerYear: { year: number; ownership_if_hold: number; dilution: number }[] = [];

  // Assuming linear 10-year release
  for (let year = 1; year <= 10; year++) {
    const newSupply = current + ((max - current) * year) / 10;
    const ownershipRetained = (current / newSupply) * 100;
    dilutionPerYear.push({
      year,
      ownership_if_hold: Number(ownershipRetained.toFixed(2)),
      dilution: Number((100 - ownershipRetained).toFixed(2)),
    });
  }

  return {
    max_dilution_percent: remainingPercent.toFixed(2) + '%',
    yearly_dilution_projection: dilutionPerYear,
    interpretation:
      remainingPercent > 100
        ? 'High dilution risk - supply can more than double'
        : remainingPercent > 50
          ? 'Moderate dilution risk'
          : 'Low dilution risk - most supply already circulating',
  };
}

function assessSupplyRisk(circulatingRatio: number, fdvRatio: number): Record<string, unknown> {
  const risks: string[] = [];
  let riskLevel = 'Low';

  if (circulatingRatio < 0.2) {
    risks.push('Very low circulating supply - high future dilution');
    riskLevel = 'High';
  } else if (circulatingRatio < 0.5) {
    risks.push('Moderate circulating supply - some dilution expected');
    if (riskLevel !== 'High') riskLevel = 'Medium';
  }

  if (fdvRatio > 5) {
    risks.push('FDV significantly exceeds market cap - overvaluation risk');
    riskLevel = 'High';
  } else if (fdvRatio > 2) {
    risks.push('FDV moderately exceeds market cap');
    if (riskLevel !== 'High') riskLevel = 'Medium';
  }

  if (risks.length === 0) {
    risks.push('Supply metrics appear healthy');
  }

  return {
    risk_level: riskLevel,
    risk_factors: risks,
  };
}

function generateVestingSchedule(args: Record<string, unknown>): Record<string, unknown> {
  const vestingType = (args.vesting_type as VestingType) || 'cliff_then_linear';
  const totalTokens = (args.total_tokens as number) || 1_000_000;
  const vestingMonths = (args.vesting_months as number) || 36;
  const cliffMonths = (args.cliff_months as number) || 12;
  const tgePercentage = (args.tge_percentage as number) || 0;

  const schedule: { month: number; unlocked: number; cumulative: number; percentage: number }[] =
    [];
  let cumulative = 0;

  // TGE unlock
  const tgeUnlock = totalTokens * (tgePercentage / 100);
  cumulative = tgeUnlock;

  for (let month = 0; month <= vestingMonths; month++) {
    let unlocked = 0;

    if (month === 0) {
      unlocked = tgeUnlock;
    } else if (month <= cliffMonths) {
      // During cliff, no unlocks
      unlocked = 0;
    } else {
      // After cliff
      const vestableTokens = totalTokens - tgeUnlock;
      const vestingPeriod = vestingMonths - cliffMonths;

      switch (vestingType) {
        case 'linear':
        case 'cliff_then_linear':
          unlocked = vestableTokens / vestingPeriod;
          break;

        case 'exponential':
          // More tokens unlock later
          const progress = (month - cliffMonths) / vestingPeriod;
          const nextProgress = (month - cliffMonths + 1) / vestingPeriod;
          unlocked = vestableTokens * (Math.pow(nextProgress, 2) - Math.pow(progress, 2));
          break;

        case 'step':
          // Quarterly unlocks
          if ((month - cliffMonths) % 3 === 0) {
            unlocked = vestableTokens / (vestingPeriod / 3);
          }
          break;

        case 'milestone':
          // Equal unlocks at milestones (6-month intervals)
          if ((month - cliffMonths) % 6 === 0) {
            unlocked = vestableTokens / (vestingPeriod / 6);
          }
          break;
      }
    }

    cumulative += unlocked;
    cumulative = Math.min(cumulative, totalTokens);

    schedule.push({
      month,
      unlocked: Math.round(unlocked),
      cumulative: Math.round(cumulative),
      percentage: Number(((cumulative / totalTokens) * 100).toFixed(2)),
    });
  }

  // Key milestones
  const milestones = [
    { name: 'TGE', month: 0, unlocked: tgePercentage + '%' },
    {
      name: 'Cliff End',
      month: cliffMonths,
      unlocked: schedule[cliffMonths]?.percentage + '%' || 'N/A',
    },
    { name: '50% Vested', month: findMilestoneMonth(schedule, 50), unlocked: '50%' },
    { name: 'Full Vest', month: vestingMonths, unlocked: '100%' },
  ];

  return {
    operation: 'vesting_schedule',
    parameters: {
      vesting_type: vestingType,
      total_tokens: totalTokens,
      vesting_months: vestingMonths,
      cliff_months: cliffMonths,
      tge_percentage: tgePercentage,
    },
    schedule: schedule.filter((_, i) => i % 3 === 0 || i === schedule.length - 1), // Show quarterly
    milestones,
    summary: {
      tokens_at_tge: Math.round(tgeUnlock),
      tokens_after_cliff: schedule[cliffMonths]?.cumulative || tgeUnlock,
      monthly_unlock_avg: Math.round((totalTokens - tgeUnlock) / (vestingMonths - cliffMonths)),
    },
  };
}

function findMilestoneMonth(schedule: { percentage: number }[], targetPercent: number): number {
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i].percentage >= targetPercent) return i;
  }
  return schedule.length - 1;
}

function modelInflation(args: Record<string, unknown>): Record<string, unknown> {
  const modelType = (args.model_type as string) || 'fixed';
  const initialSupply = (args.initial_supply as number) || 1_000_000_000;
  const years = (args.years as number) || 10;

  const modelInfo = INFLATION_MODELS[modelType] || INFLATION_MODELS['fixed'];
  const projection: { year: number; supply: number; inflation_rate: number; new_tokens: number }[] =
    [];

  let currentSupply = initialSupply;

  switch (modelType) {
    case 'fixed': {
      const annualRate = (args.annual_rate as number) || 0.05;
      for (let year = 0; year <= years; year++) {
        const newTokens = year === 0 ? 0 : currentSupply * annualRate;
        currentSupply += newTokens;
        projection.push({
          year,
          supply: Math.round(currentSupply),
          inflation_rate: year === 0 ? 0 : annualRate * 100,
          new_tokens: Math.round(newTokens),
        });
      }
      break;
    }

    case 'decreasing': {
      const halvingPeriod = (args.halving_period as number) || 4;
      const initialReward = (args.initial_reward as number) || 50_000_000;

      for (let year = 0; year <= years; year++) {
        const halvings = Math.floor(year / halvingPeriod);
        const currentReward = initialReward / Math.pow(2, halvings);
        const newTokens = year === 0 ? 0 : currentReward;
        const rate = year === 0 ? 0 : (newTokens / currentSupply) * 100;
        currentSupply += newTokens;

        projection.push({
          year,
          supply: Math.round(currentSupply),
          inflation_rate: Number(rate.toFixed(2)),
          new_tokens: Math.round(newTokens),
        });
      }
      break;
    }

    case 'asymptotic': {
      const maxSupply = (args.max_supply as number) || 2_000_000_000;
      const k = (args.k_rate as number) || 0.2;

      for (let year = 0; year <= years; year++) {
        const targetSupply = maxSupply * (1 - Math.exp(-k * year));
        const newTokens =
          year === 0 ? 0 : targetSupply - maxSupply * (1 - Math.exp(-k * (year - 1)));
        const rate = year === 0 ? 0 : (newTokens / currentSupply) * 100;
        currentSupply = Math.max(initialSupply, targetSupply);

        projection.push({
          year,
          supply: Math.round(currentSupply),
          inflation_rate: Number(rate.toFixed(2)),
          new_tokens: Math.round(newTokens),
        });
      }
      break;
    }

    case 'dynamic': {
      const baseRate = (args.annual_rate as number) || 0.1;
      const targetStaking = (args.staking_ratio as number) || 0.67;
      let stakingRatio = (args.staking_ratio as number) || 0.3;

      for (let year = 0; year <= years; year++) {
        // Inflation adjusts to incentivize target staking ratio
        const adjustedRate = baseRate * (1 - stakingRatio / targetStaking);
        const effectiveRate = Math.max(0, Math.min(baseRate * 2, adjustedRate));
        const newTokens = year === 0 ? 0 : currentSupply * effectiveRate;
        currentSupply += newTokens;

        // Staking ratio gravitates toward target
        stakingRatio = stakingRatio + (targetStaking - stakingRatio) * 0.2;

        projection.push({
          year,
          supply: Math.round(currentSupply),
          inflation_rate: Number((effectiveRate * 100).toFixed(2)),
          new_tokens: Math.round(newTokens),
        });
      }
      break;
    }

    case 'deflationary': {
      const emissionRate = (args.annual_rate as number) || 0.03;
      const burnRate = (args.burn_rate as number) || 0.05;

      for (let year = 0; year <= years; year++) {
        const emissions = year === 0 ? 0 : currentSupply * emissionRate;
        const burns = year === 0 ? 0 : currentSupply * burnRate;
        const netChange = emissions - burns;
        currentSupply = Math.max(currentSupply * 0.5, currentSupply + netChange);

        projection.push({
          year,
          supply: Math.round(currentSupply),
          inflation_rate: Number(((netChange / (currentSupply - netChange)) * 100).toFixed(2)),
          new_tokens: Math.round(netChange),
        });
      }
      break;
    }
  }

  const totalInflation = ((projection[years].supply - initialSupply) / initialSupply) * 100;
  const avgAnnualInflation =
    projection.slice(1).reduce((sum, p) => sum + p.inflation_rate, 0) / years;

  return {
    operation: 'inflation_model',
    model: {
      type: modelType,
      description: modelInfo.description,
      formula: modelInfo.formula,
      parameters: modelInfo.parameters,
    },
    projection,
    summary: {
      initial_supply: initialSupply,
      final_supply: projection[years].supply,
      total_inflation: totalInflation.toFixed(2) + '%',
      average_annual_inflation: avgAnnualInflation.toFixed(2) + '%',
      supply_multiple: (projection[years].supply / initialSupply).toFixed(2) + 'x',
    },
  };
}

function analyzeDistribution(args: Record<string, unknown>): Record<string, unknown> {
  const template = (args.template as string) || 'defi_protocol';
  const totalSupply = (args.max_supply as number) || 1_000_000_000;

  let allocations: AllocationCategory[];

  if (template === 'custom' && args.allocations) {
    allocations = args.allocations as AllocationCategory[];
  } else {
    allocations = ALLOCATION_TEMPLATES[template] || ALLOCATION_TEMPLATES['defi_protocol'];
  }

  // Validate allocations sum to 100%
  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);

  // Calculate token amounts and weighted vesting
  const distribution = allocations.map((allocation) => ({
    category: allocation.name,
    percentage: allocation.percentage + '%',
    tokens: Math.round(totalSupply * (allocation.percentage / 100)),
    vesting_months: allocation.vestingMonths,
    cliff_months: allocation.cliffMonths,
    description: allocation.description,
  }));

  // Calculate weighted average vesting
  const weightedVesting =
    allocations.reduce((sum, a) => sum + a.vestingMonths * a.percentage, 0) / 100;

  // Centralization metrics
  const insiderAllocation = allocations
    .filter((a) =>
      ['Team', 'Team & Advisors', 'Advisors', 'Investors', 'Private Sale'].includes(a.name)
    )
    .reduce((sum, a) => sum + a.percentage, 0);

  const communityAllocation = 100 - insiderAllocation;

  // Unlock timeline
  const unlockTimeline = generateUnlockTimeline(allocations, totalSupply);

  return {
    operation: 'distribution',
    template: template,
    total_supply: totalSupply,
    allocation_valid: Math.abs(totalPercentage - 100) < 0.01,
    distribution,
    metrics: {
      weighted_avg_vesting_months: weightedVesting.toFixed(1),
      insider_allocation: insiderAllocation + '%',
      community_allocation: communityAllocation + '%',
      decentralization_score: calculateDecentralizationScore(insiderAllocation, weightedVesting),
    },
    unlock_summary: unlockTimeline,
    recommendations: generateDistributionRecommendations(
      insiderAllocation,
      weightedVesting,
      allocations
    ),
  };
}

function generateUnlockTimeline(
  allocations: AllocationCategory[],
  totalSupply: number
): { month: number; unlocked_percent: number; unlocked_tokens: number }[] {
  const maxMonth = Math.max(...allocations.map((a) => a.vestingMonths));
  const timeline: { month: number; unlocked_percent: number; unlocked_tokens: number }[] = [];

  for (let month = 0; month <= maxMonth; month += 6) {
    let totalUnlocked = 0;

    for (const alloc of allocations) {
      const tokens = totalSupply * (alloc.percentage / 100);

      if (month < alloc.cliffMonths) {
        // Still in cliff
        continue;
      } else if (alloc.vestingMonths === 0) {
        // Immediate unlock
        totalUnlocked += tokens;
      } else {
        // Linear vesting after cliff
        const vestingPeriod = alloc.vestingMonths - alloc.cliffMonths;
        const monthsVested = Math.min(month - alloc.cliffMonths, vestingPeriod);
        const vestedFraction = vestingPeriod > 0 ? monthsVested / vestingPeriod : 1;
        totalUnlocked += tokens * vestedFraction;
      }
    }

    timeline.push({
      month,
      unlocked_percent: Number(((totalUnlocked / totalSupply) * 100).toFixed(1)),
      unlocked_tokens: Math.round(totalUnlocked),
    });
  }

  return timeline;
}

function calculateDecentralizationScore(insiderPercent: number, avgVesting: number): string {
  // Score 0-100, higher is more decentralized
  let score = 100;

  // Penalize high insider allocation
  score -= insiderPercent * 0.8;

  // Reward longer vesting (up to 24 months)
  score += Math.min(avgVesting, 24) * 0.5;

  score = Math.max(0, Math.min(100, score));

  if (score >= 70) return `${score.toFixed(0)}/100 (Good)`;
  if (score >= 50) return `${score.toFixed(0)}/100 (Moderate)`;
  return `${score.toFixed(0)}/100 (Centralized)`;
}

function generateDistributionRecommendations(
  insiderPercent: number,
  avgVesting: number,
  allocations: AllocationCategory[]
): string[] {
  const recommendations: string[] = [];

  if (insiderPercent > 40) {
    recommendations.push(
      'Consider reducing insider allocation below 40% for better decentralization'
    );
  }

  if (avgVesting < 18) {
    recommendations.push('Longer vesting periods (18+ months avg) signal long-term commitment');
  }

  const teamAlloc = allocations.find((a) => a.name.includes('Team'));
  if (teamAlloc && teamAlloc.cliffMonths < 12) {
    recommendations.push('Team allocation should have at least 12-month cliff');
  }

  const treasuryAlloc = allocations.find(
    (a) => a.name.includes('Treasury') || a.name.includes('Community')
  );
  if (!treasuryAlloc || treasuryAlloc.percentage < 20) {
    recommendations.push('Consider allocating at least 20% to community treasury');
  }

  if (recommendations.length === 0) {
    recommendations.push('Token distribution appears well-balanced');
  }

  return recommendations;
}

function analyzeVelocity(args: Record<string, unknown>): Record<string, unknown> {
  const sector = (args.sector as string) || 'utility';
  const gdp = (args.gdp as number) || 100_000_000;
  const currentSupply = (args.current_supply as number) || 1_000_000_000;
  const price = (args.price as number) || 1;

  const benchmark = VELOCITY_BENCHMARKS[sector] || VELOCITY_BENCHMARKS['utility'];

  // Equation of Exchange: MV = PQ (where M = money supply, V = velocity, P*Q = GDP)
  const marketCap = currentSupply * price;
  const impliedVelocity = gdp / marketCap;

  // Calculate fair values at different velocities
  const fairValues = {
    low_velocity: gdp / (currentSupply * benchmark.low),
    median_velocity: gdp / (currentSupply * benchmark.median),
    high_velocity: gdp / (currentSupply * benchmark.high),
  };

  // Velocity comparison
  let velocityAssessment: string;
  if (impliedVelocity < benchmark.low) {
    velocityAssessment = 'Very low velocity - token may be overvalued or strong store-of-value';
  } else if (impliedVelocity < benchmark.median) {
    velocityAssessment = 'Below median velocity for sector';
  } else if (impliedVelocity < benchmark.high) {
    velocityAssessment = 'Above median but within normal range';
  } else {
    velocityAssessment = 'High velocity - token may be undervalued or lacks holding incentives';
  }

  return {
    operation: 'token_velocity',
    equation_of_exchange: {
      formula: 'M × V = P × Q (Money Supply × Velocity = Price Level × Economic Output)',
      market_cap_M: marketCap,
      economic_value_PQ: gdp,
      implied_velocity_V: impliedVelocity.toFixed(2),
    },
    sector_benchmarks: {
      sector,
      low: benchmark.low,
      median: benchmark.median,
      high: benchmark.high,
    },
    fair_value_analysis: {
      at_low_velocity: '$' + fairValues.low_velocity.toFixed(4),
      at_median_velocity: '$' + fairValues.median_velocity.toFixed(4),
      at_high_velocity: '$' + fairValues.high_velocity.toFixed(4),
      current_price: '$' + price.toFixed(4),
    },
    assessment: velocityAssessment,
    velocity_reduction_strategies: [
      'Staking rewards to lock tokens',
      'Governance utility requiring holding',
      'Fee discounts for token holders',
      'Buyback and burn mechanisms',
      'Tiered benefits based on holding duration',
    ],
  };
}

function calculateValuation(args: Record<string, unknown>): Record<string, unknown> {
  const currentSupply = (args.current_supply as number) || 1_000_000_000;
  const maxSupply = (args.max_supply as number) || 1_000_000_000;
  const price = (args.price as number) || 1;
  const gdp = (args.gdp as number) || 100_000_000;
  const sector = (args.sector as string) || 'utility';

  const marketCap = currentSupply * price;
  const fdv = maxSupply * price;

  // Multiple valuation methodologies
  const benchmark = VELOCITY_BENCHMARKS[sector] || VELOCITY_BENCHMARKS['utility'];

  // 1. Equation of Exchange valuation
  const eoeValuation = gdp / (currentSupply * benchmark.median);

  // 2. Network Value to Transactions (NVT) implied
  const nvtRatio = marketCap / gdp;
  let nvtAssessment: string;
  if (nvtRatio < 10) nvtAssessment = 'Potentially undervalued (NVT < 10)';
  else if (nvtRatio < 30) nvtAssessment = 'Fairly valued (NVT 10-30)';
  else nvtAssessment = 'Potentially overvalued (NVT > 30)';

  // 3. Comparable analysis (sector multiples)
  const sectorMultiples: Record<string, number> = {
    currency: 50,
    defi: 20,
    governance: 15,
    utility: 25,
    store_of_value: 100,
    gaming: 30,
  };
  const comparableValuation = (gdp * (sectorMultiples[sector] || 25)) / currentSupply;

  return {
    operation: 'valuation',
    current_metrics: {
      price: '$' + price.toFixed(4),
      market_cap: '$' + marketCap.toLocaleString(),
      fully_diluted_value: '$' + fdv.toLocaleString(),
      economic_throughput: '$' + gdp.toLocaleString(),
    },
    valuation_models: {
      equation_of_exchange: {
        fair_value: '$' + eoeValuation.toFixed(4),
        upside_downside: (((eoeValuation - price) / price) * 100).toFixed(1) + '%',
        methodology: 'GDP / (Supply × Median Velocity)',
      },
      nvt_analysis: {
        nvt_ratio: nvtRatio.toFixed(2),
        assessment: nvtAssessment,
      },
      comparable_analysis: {
        sector,
        sector_multiple: sectorMultiples[sector] || 25,
        fair_value: '$' + comparableValuation.toFixed(4),
        upside_downside: (((comparableValuation - price) / price) * 100).toFixed(1) + '%',
      },
    },
    consensus_fair_value: {
      average: '$' + ((eoeValuation + comparableValuation) / 2).toFixed(4),
      range_low: '$' + Math.min(eoeValuation, comparableValuation).toFixed(4),
      range_high: '$' + Math.max(eoeValuation, comparableValuation).toFixed(4),
    },
    disclaimer: 'Valuations are theoretical models and not investment advice',
  };
}

function generateUnlockCalendar(args: Record<string, unknown>): Record<string, unknown> {
  const template = (args.template as string) || 'defi_protocol';
  const totalSupply = (args.max_supply as number) || 1_000_000_000;
  const price = (args.price as number) || 1;

  const allocations = ALLOCATION_TEMPLATES[template] || ALLOCATION_TEMPLATES['defi_protocol'];

  // Generate monthly unlock events
  const events: {
    month: number;
    category: string;
    tokens_unlocked: number;
    value_usd: number;
    event_type: string;
  }[] = [];

  for (const alloc of allocations) {
    const tokens = totalSupply * (alloc.percentage / 100);

    if (alloc.vestingMonths === 0) {
      // Immediate unlock
      events.push({
        month: 0,
        category: alloc.name,
        tokens_unlocked: tokens,
        value_usd: tokens * price,
        event_type: 'TGE Full Unlock',
      });
    } else {
      // Cliff event
      if (alloc.cliffMonths > 0) {
        events.push({
          month: alloc.cliffMonths,
          category: alloc.name,
          tokens_unlocked: 0,
          value_usd: 0,
          event_type: 'Cliff End - Vesting Begins',
        });
      }

      // Monthly unlocks after cliff (simplified - show quarterly)
      const vestingPeriod = alloc.vestingMonths - alloc.cliffMonths;
      const quarterlyUnlock = tokens / (vestingPeriod / 3);

      for (let q = 1; q <= vestingPeriod / 3; q++) {
        const month = alloc.cliffMonths + q * 3;
        events.push({
          month,
          category: alloc.name,
          tokens_unlocked: quarterlyUnlock,
          value_usd: quarterlyUnlock * price,
          event_type: 'Quarterly Unlock',
        });
      }
    }
  }

  // Sort by month
  events.sort((a, b) => a.month - b.month);

  // Aggregate by month
  const monthlyAggregate: Record<
    number,
    {
      total_tokens: number;
      total_value: number;
      categories: string[];
    }
  > = {};

  for (const event of events) {
    if (!monthlyAggregate[event.month]) {
      monthlyAggregate[event.month] = { total_tokens: 0, total_value: 0, categories: [] };
    }
    monthlyAggregate[event.month].total_tokens += event.tokens_unlocked;
    monthlyAggregate[event.month].total_value += event.value_usd;
    if (!monthlyAggregate[event.month].categories.includes(event.category)) {
      monthlyAggregate[event.month].categories.push(event.category);
    }
  }

  const calendar = Object.entries(monthlyAggregate)
    .map(([month, data]) => ({
      month: parseInt(month),
      total_tokens: Math.round(data.total_tokens),
      total_value_usd: Math.round(data.total_value),
      percent_of_supply: ((data.total_tokens / totalSupply) * 100).toFixed(2) + '%',
      categories: data.categories,
    }))
    .filter((entry) => entry.total_tokens > 0);

  // Identify high-impact months
  const avgMonthlyUnlock = totalSupply / 48; // Assume 4-year distribution
  const highImpactMonths = calendar.filter((m) => m.total_tokens > avgMonthlyUnlock * 2);

  return {
    operation: 'unlock_calendar',
    template,
    total_supply: totalSupply,
    price_assumption: price,
    calendar: calendar.slice(0, 24), // Show first 2 years
    high_impact_months: highImpactMonths.map((m) => ({
      month: m.month,
      tokens: m.total_tokens,
      percent: m.percent_of_supply,
      warning: 'Large unlock - potential sell pressure',
    })),
    yearly_summary: {
      year_1: calendar.filter((m) => m.month <= 12).reduce((sum, m) => sum + m.total_tokens, 0),
      year_2: calendar
        .filter((m) => m.month > 12 && m.month <= 24)
        .reduce((sum, m) => sum + m.total_tokens, 0),
      year_3: calendar
        .filter((m) => m.month > 24 && m.month <= 36)
        .reduce((sum, m) => sum + m.total_tokens, 0),
      year_4: calendar
        .filter((m) => m.month > 36 && m.month <= 48)
        .reduce((sum, m) => sum + m.total_tokens, 0),
    },
  };
}

function analyzeStakingEconomics(args: Record<string, unknown>): Record<string, unknown> {
  const totalSupply = (args.current_supply as number) || 1_000_000_000;
  const stakingApy = (args.staking_apy as number) || 0.1;
  const stakingRatio = (args.staking_ratio as number) || 0.5;
  const lockPeriodDays = (args.lock_period_days as number) || 30;
  const price = (args.price as number) || 1;

  const stakedTokens = totalSupply * stakingRatio;
  const liquidTokens = totalSupply - stakedTokens;

  // Annual staking rewards
  const annualRewards = stakedTokens * stakingApy;
  const annualRewardsValue = annualRewards * price;

  // Effective inflation from staking
  const effectiveInflation = (annualRewards / totalSupply) * 100;

  // Real yield for stakers (APY adjusted for dilution)
  const dilutionToNonStakers = effectiveInflation;
  const realYieldForStakers = stakingApy * 100 - effectiveInflation * (1 - stakingRatio);

  // Staking equilibrium analysis
  const equilibriumStakingRatio = findStakingEquilibrium(stakingApy, effectiveInflation / 100);

  return {
    operation: 'staking_economics',
    parameters: {
      total_supply: totalSupply,
      staking_apy: (stakingApy * 100).toFixed(1) + '%',
      current_staking_ratio: (stakingRatio * 100).toFixed(1) + '%',
      lock_period_days: lockPeriodDays,
    },
    staking_metrics: {
      staked_tokens: stakedTokens,
      staked_value_usd: stakedTokens * price,
      liquid_tokens: liquidTokens,
      liquid_value_usd: liquidTokens * price,
    },
    rewards_analysis: {
      annual_rewards_tokens: Math.round(annualRewards),
      annual_rewards_usd: annualRewardsValue,
      effective_inflation: effectiveInflation.toFixed(2) + '%',
      real_yield_stakers: realYieldForStakers.toFixed(2) + '%',
      dilution_non_stakers: dilutionToNonStakers.toFixed(2) + '%',
    },
    economics: {
      staking_incentive_score: calculateStakingIncentive(stakingApy, lockPeriodDays),
      equilibrium_staking_ratio: (equilibriumStakingRatio * 100).toFixed(1) + '%',
      current_vs_equilibrium:
        stakingRatio > equilibriumStakingRatio ? 'Over-staked' : 'Under-staked',
    },
    recommendations: generateStakingRecommendations(stakingApy, stakingRatio, lockPeriodDays),
  };
}

function findStakingEquilibrium(apy: number, inflation: number): number {
  // Simplified equilibrium model
  // Staking equilibrium occurs when marginal benefit equals marginal cost
  // Higher APY attracts more stakers until real yield diminishes
  const baseEquilibrium = 0.5;
  const apyFactor = Math.min(apy / 0.1, 2); // Normalize to 10% APY baseline
  const inflationPenalty = Math.min(inflation / 0.05, 1);

  return Math.min(0.9, Math.max(0.2, baseEquilibrium * apyFactor * (1 - inflationPenalty * 0.3)));
}

function calculateStakingIncentive(apy: number, lockDays: number): string {
  const score = (apy * 100) / Math.sqrt(lockDays / 30);

  if (score > 20) return 'Very Strong';
  if (score > 10) return 'Strong';
  if (score > 5) return 'Moderate';
  return 'Weak';
}

function generateStakingRecommendations(apy: number, ratio: number, lockDays: number): string[] {
  const recommendations: string[] = [];

  if (apy < 0.05) {
    recommendations.push('Consider increasing staking APY to attract more stakers');
  }

  if (ratio < 0.3) {
    recommendations.push('Low staking ratio may indicate weak tokenomics or high opportunity cost');
  } else if (ratio > 0.8) {
    recommendations.push('Very high staking ratio may reduce liquidity and price discovery');
  }

  if (lockDays > 90 && apy < 0.15) {
    recommendations.push('Long lock periods should be compensated with higher APY');
  }

  if (recommendations.length === 0) {
    recommendations.push('Staking economics appear balanced');
  }

  return recommendations;
}

function getExamples(): Record<string, unknown> {
  return {
    operation: 'examples',
    examples: [
      {
        name: 'Analyze token supply',
        call: {
          operation: 'supply_analysis',
          initial_supply: 1000000000,
          max_supply: 2000000000,
          current_supply: 500000000,
          price: 0.5,
          years: 10,
        },
      },
      {
        name: 'Generate vesting schedule',
        call: {
          operation: 'vesting_schedule',
          vesting_type: 'cliff_then_linear',
          total_tokens: 10000000,
          vesting_months: 36,
          cliff_months: 12,
          tge_percentage: 10,
        },
      },
      {
        name: 'Model inflation',
        call: {
          operation: 'inflation_model',
          model_type: 'decreasing',
          initial_supply: 1000000000,
          halving_period: 4,
          initial_reward: 50000000,
          years: 20,
        },
      },
      {
        name: 'Analyze distribution',
        call: {
          operation: 'distribution',
          template: 'defi_protocol',
          max_supply: 1000000000,
        },
      },
      {
        name: 'Token velocity analysis',
        call: {
          operation: 'token_velocity',
          sector: 'defi',
          gdp: 500000000,
          current_supply: 100000000,
          price: 10,
        },
      },
      {
        name: 'Staking economics',
        call: {
          operation: 'staking_economics',
          current_supply: 1000000000,
          staking_apy: 0.12,
          staking_ratio: 0.45,
          lock_period_days: 30,
          price: 1.5,
        },
      },
    ],
  };
}

function getInfo(): Record<string, unknown> {
  return {
    operation: 'info',
    tool: 'token_economics',
    description: 'Comprehensive tokenomics analysis and design tool',
    capabilities: [
      'Supply analysis with dilution projections',
      'Vesting schedule generation (linear, cliff, milestone, exponential)',
      'Inflation modeling (fixed, decreasing, asymptotic, dynamic, deflationary)',
      'Token distribution analysis with templates',
      'Token velocity and equation of exchange analysis',
      'Multi-method valuation (NVT, comparable, equation of exchange)',
      'Unlock calendar generation',
      'Staking economics analysis',
    ],
    operations: {
      supply_analysis: 'Analyze token supply metrics, dilution, and projections',
      vesting_schedule: 'Generate detailed vesting schedules with milestones',
      inflation_model: 'Model different inflation/emission schedules',
      distribution: 'Analyze token allocation using templates or custom',
      token_velocity: 'Equation of exchange and velocity analysis',
      valuation: 'Multiple valuation methodologies for fair value',
      unlock_calendar: 'Generate unlock events calendar',
      staking_economics: 'Analyze staking rewards and economics',
      info: 'Display this information',
      examples: 'Show example API calls',
    },
    distribution_templates: Object.keys(ALLOCATION_TEMPLATES),
    inflation_models: Object.keys(INFLATION_MODELS),
    velocity_sectors: Object.keys(VELOCITY_BENCHMARKS),
    references: [
      'Equation of Exchange (Fisher)',
      'NVT Ratio (Willy Woo)',
      'Token Velocity Problem (Vitalik Buterin)',
      'Staking Derivatives Research',
    ],
  };
}

export function istokeneconomicsAvailable(): boolean {
  return true;
}
