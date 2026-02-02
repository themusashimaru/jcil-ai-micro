/**
 * AUCTION-THEORY TOOL
 * Auction mechanism design and game-theoretic analysis
 * Implements: First/Second Price, English, Dutch, VCG, Revenue Equivalence
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const auctiontheoryTool: UnifiedTool = {
  name: 'auction_theory',
  description: 'Auction theory and mechanism design with bidding strategies',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'simulate', 'optimal_bid', 'revenue_equivalence', 'vcg', 'compare', 'strategy', 'demonstrate'],
        description: 'Operation to perform'
      },
      auction_type: {
        type: 'string',
        enum: ['first_price', 'second_price', 'english', 'dutch', 'all_pay', 'vcg'],
        description: 'Auction format'
      },
      bidders: { type: 'number', description: 'Number of bidders' },
      valuations: { type: 'array', items: { type: 'number' }, description: 'Private valuations' },
      bids: { type: 'array', items: { type: 'number' }, description: 'Submitted bids' },
      reserve_price: { type: 'number', description: 'Minimum acceptable price' },
      value: { type: 'number', description: 'Bidder private value' },
      distribution: { type: 'string', enum: ['uniform', 'normal', 'exponential'], description: 'Value distribution' },
      items: { type: 'array', items: { type: 'object' }, description: 'Items for multi-unit auction' }
    },
    required: ['operation']
  }
};

// Auction Types and Mechanics
interface AuctionResult {
  winner: number;
  winningBid: number;
  payment: number;
  surplus: number;
  revenue: number;
}

interface BidderInfo {
  id: number;
  valuation: number;
  bid: number;
  surplus: number;
  isWinner: boolean;
}

// First-price sealed-bid auction
function firstPriceAuction(valuations: number[], bids: number[], reservePrice: number = 0): AuctionResult {
  let winner = -1;
  let winningBid = reservePrice;

  for (let i = 0; i < bids.length; i++) {
    if (bids[i] > winningBid && bids[i] >= reservePrice) {
      winner = i;
      winningBid = bids[i];
    }
  }

  const payment = winner >= 0 ? winningBid : 0;
  const surplus = winner >= 0 ? valuations[winner] - payment : 0;

  return {
    winner,
    winningBid,
    payment,
    surplus,
    revenue: payment
  };
}

// Second-price sealed-bid (Vickrey) auction
function secondPriceAuction(valuations: number[], bids: number[], reservePrice: number = 0): AuctionResult {
  // Find highest and second-highest bids
  let winner = -1;
  let highest = reservePrice;
  let secondHighest = reservePrice;

  for (let i = 0; i < bids.length; i++) {
    if (bids[i] > highest && bids[i] >= reservePrice) {
      secondHighest = highest;
      highest = bids[i];
      winner = i;
    } else if (bids[i] > secondHighest && bids[i] >= reservePrice) {
      secondHighest = bids[i];
    }
  }

  const payment = winner >= 0 ? secondHighest : 0;
  const surplus = winner >= 0 ? valuations[winner] - payment : 0;

  return {
    winner,
    winningBid: highest,
    payment,
    surplus,
    revenue: payment
  };
}

// Simulate English (ascending) auction
function englishAuction(valuations: number[], reservePrice: number = 0, increment: number = 1): AuctionResult & { rounds: number } {
  const active = valuations.map((v, i) => ({ id: i, val: v, active: v >= reservePrice }));
  let currentPrice = reservePrice;
  let rounds = 0;

  while (active.filter(b => b.active).length > 1) {
    currentPrice += increment;
    rounds++;

    for (const bidder of active) {
      if (bidder.val < currentPrice) {
        bidder.active = false;
      }
    }
  }

  const remaining = active.filter(b => b.active);
  const winner = remaining.length > 0 ? remaining[0].id : -1;
  const winningBid = currentPrice;

  // In English auction, winner pays the drop-out price of second-highest
  const sortedVals = [...valuations].sort((a, b) => b - a);
  const secondHighest = sortedVals.length > 1 ? sortedVals[1] : reservePrice;
  const payment = Math.max(secondHighest, reservePrice);

  const surplus = winner >= 0 ? valuations[winner] - payment : 0;

  return {
    winner,
    winningBid,
    payment,
    surplus,
    revenue: payment,
    rounds
  };
}

// Simulate Dutch (descending) auction
function dutchAuction(valuations: number[], startPrice: number, decrement: number = 1): AuctionResult & { rounds: number } {
  let currentPrice = startPrice;
  let rounds = 0;

  // Price descends until someone accepts
  while (currentPrice > 0) {
    rounds++;

    // Check if any bidder accepts at current price
    for (let i = 0; i < valuations.length; i++) {
      // Optimal: accept when price drops to your value
      if (currentPrice <= valuations[i]) {
        return {
          winner: i,
          winningBid: currentPrice,
          payment: currentPrice,
          surplus: valuations[i] - currentPrice,
          revenue: currentPrice,
          rounds
        };
      }
    }

    currentPrice -= decrement;
  }

  return {
    winner: -1,
    winningBid: 0,
    payment: 0,
    surplus: 0,
    revenue: 0,
    rounds
  };
}

// All-pay auction (everyone pays their bid, highest wins)
function allPayAuction(valuations: number[], bids: number[]): AuctionResult & { totalRevenue: number } {
  let winner = -1;
  let winningBid = 0;

  for (let i = 0; i < bids.length; i++) {
    if (bids[i] > winningBid) {
      winningBid = bids[i];
      winner = i;
    }
  }

  const totalRevenue = bids.reduce((sum, b) => sum + b, 0);
  const surplus = winner >= 0 ? valuations[winner] - bids[winner] : 0;

  return {
    winner,
    winningBid,
    payment: bids[winner] || 0,
    surplus,
    revenue: totalRevenue,
    totalRevenue
  };
}

// VCG (Vickrey-Clarke-Groves) mechanism for multi-item auctions
function vcgAuction(items: { name: string; bids: number[] }[], bidderCount: number): {
  allocation: { item: string; winner: number; payment: number }[];
  totalRevenue: number;
  efficient: boolean;
} {
  // Simple VCG for single items with multiple bidders
  const allocation: { item: string; winner: number; payment: number }[] = [];
  let totalRevenue = 0;

  for (const item of items) {
    // Find winner (highest bidder)
    let winner = -1;
    let highest = 0;
    let secondHighest = 0;

    for (let i = 0; i < item.bids.length; i++) {
      if (item.bids[i] > highest) {
        secondHighest = highest;
        highest = item.bids[i];
        winner = i;
      } else if (item.bids[i] > secondHighest) {
        secondHighest = item.bids[i];
      }
    }

    // VCG payment = social welfare without winner - social welfare of others with winner
    // For single item: payment = second-highest bid
    const payment = secondHighest;

    allocation.push({
      item: item.name,
      winner,
      payment
    });

    totalRevenue += payment;
  }

  return {
    allocation,
    totalRevenue,
    efficient: true // VCG is always efficient
  };
}

// Optimal bidding strategy in first-price auction
function optimalFirstPriceBid(value: number, n: number, distribution: string = 'uniform'): {
  optimalBid: number;
  expectedPayoff: number;
  bidShading: number;
  formula: string;
} {
  // For uniform[0,1] distribution with n symmetric bidders:
  // Optimal bid = (n-1)/n * value (bid shading)

  let optimalBid: number;
  let formula: string;

  if (distribution === 'uniform') {
    // Symmetric equilibrium for uniform distribution
    optimalBid = ((n - 1) / n) * value;
    formula = `b(v) = ((n-1)/n) × v = ${((n-1)/n).toFixed(4)} × v`;
  } else if (distribution === 'exponential') {
    // For exponential with rate λ
    optimalBid = value * (n - 1) / n; // Approximate
    formula = `b(v) ≈ ((n-1)/n) × v for exponential`;
  } else {
    optimalBid = value * (n - 1) / n;
    formula = `b(v) = ((n-1)/n) × v (general approximation)`;
  }

  const bidShading = value - optimalBid;

  // Expected payoff calculation (for uniform)
  // P(win) = (bid/v_max)^(n-1) for uniform
  // E[payoff] = P(win) × (v - bid)
  const pWin = Math.pow(optimalBid, n - 1);
  const expectedPayoff = pWin * (value - optimalBid);

  return {
    optimalBid,
    expectedPayoff,
    bidShading,
    formula
  };
}

// Revenue Equivalence Theorem analysis
function revenueEquivalence(n: number, distribution: string = 'uniform'): {
  expectedRevenue: { [key: string]: number };
  explanation: string;
  conditions: string[];
} {
  // For uniform[0,1] distribution with n bidders
  // Expected revenue = (n-1)/(n+1) for all standard auctions

  const expectedRev = (n - 1) / (n + 1);

  return {
    expectedRevenue: {
      firstPrice: expectedRev,
      secondPrice: expectedRev,
      english: expectedRev,
      dutch: expectedRev,
      allPay: expectedRev
    },
    explanation: `Revenue Equivalence Theorem: All standard auctions yield the same expected revenue.
For ${n} bidders with ${distribution} valuations:
E[Revenue] = (n-1)/(n+1) = ${expectedRev.toFixed(6)}

This equals E[2nd highest value] = (n-1)/(n+1) for uniform[0,1]`,
    conditions: [
      'Risk-neutral bidders',
      'Independent private values',
      'Symmetric bidders',
      'Payment depends only on bids',
      'Efficient allocation (highest value wins)'
    ]
  };
}

// Compare auction formats
function compareAuctions(valuations: number[], reservePrice: number = 0): {
  results: { [key: string]: AuctionResult };
  comparison: string;
  recommendation: string;
} {
  // Assume truthful bidding for second-price, strategic for first-price
  const n = valuations.length;
  const strategicBids = valuations.map(v => v * (n - 1) / n);

  const results = {
    firstPrice: firstPriceAuction(valuations, strategicBids, reservePrice),
    secondPrice: secondPriceAuction(valuations, valuations, reservePrice), // Truthful
    english: englishAuction(valuations, reservePrice),
    dutch: dutchAuction(valuations, Math.max(...valuations) * 1.5)
  };

  let comparison = 'Auction Format Comparison:\n\n';
  for (const [format, result] of Object.entries(results)) {
    comparison += `${format.toUpperCase()}:\n`;
    comparison += `  Winner: Bidder ${result.winner}\n`;
    comparison += `  Payment: $${result.payment.toFixed(2)}\n`;
    comparison += `  Revenue: $${result.revenue.toFixed(2)}\n`;
    comparison += `  Winner Surplus: $${result.surplus.toFixed(2)}\n\n`;
  }

  // Recommendation based on seller objectives
  const revenues = Object.entries(results).map(([k, v]) => ({ format: k, rev: v.revenue }));
  const maxRev = revenues.reduce((max, r) => r.rev > max.rev ? r : max, revenues[0]);

  const recommendation = `For this set of valuations:
- Highest revenue: ${maxRev.format} ($${maxRev.rev.toFixed(2)})
- Second-price/English: Simplest strategy for bidders (bid truthfully)
- First-price/Dutch: Requires strategic sophistication`;

  return { results, comparison, recommendation };
}

// Strategy analysis for different auction types
function strategyAnalysis(auctionType: string, n: number, value: number): {
  strategy: string;
  dominantStrategy: boolean;
  equilibrium: string;
  advice: string;
} {
  switch (auctionType) {
    case 'second_price':
      return {
        strategy: 'Bid your true value: b(v) = v',
        dominantStrategy: true,
        equilibrium: 'Truthful bidding is a weakly dominant strategy',
        advice: 'Bid exactly what the item is worth to you. You can never lose by being truthful.'
      };

    case 'first_price':
      return {
        strategy: `Shade your bid: b(v) = ((n-1)/n) × v = ${((n-1)/n * value).toFixed(2)}`,
        dominantStrategy: false,
        equilibrium: 'Bayesian Nash equilibrium with bid shading',
        advice: `With ${n} bidders, bid ${((n-1)/n * 100).toFixed(1)}% of your value to balance winning probability against profit.`
      };

    case 'english':
      return {
        strategy: 'Stay in until price reaches your value',
        dominantStrategy: true,
        equilibrium: 'Drop out when price exceeds valuation',
        advice: 'Simply wait and drop out when the price exceeds what you\'re willing to pay.'
      };

    case 'dutch':
      return {
        strategy: 'Accept when price drops near your optimal first-price bid',
        dominantStrategy: false,
        equilibrium: 'Strategically equivalent to first-price sealed-bid',
        advice: `Stop the clock around ${((n-1)/n * 100).toFixed(1)}% of your value.`
      };

    case 'all_pay':
      return {
        strategy: `Mixed strategy with expected bid E[b] = v × (n-1)/n^2`,
        dominantStrategy: false,
        equilibrium: 'Mixed strategy equilibrium',
        advice: 'High risk - you pay even if you lose. Only bid if value is very high.'
      };

    default:
      return {
        strategy: 'Unknown auction type',
        dominantStrategy: false,
        equilibrium: 'N/A',
        advice: 'Please specify a valid auction type.'
      };
  }
}

// Simulate auction with random valuations
function simulateAuction(
  auctionType: string,
  n: number,
  distribution: string,
  reservePrice: number,
  trials: number = 1000
): {
  avgRevenue: number;
  avgWinnerSurplus: number;
  avgEfficiency: number;
  revenueStdDev: number;
} {
  const revenues: number[] = [];
  const surpluses: number[] = [];
  const efficiencies: number[] = [];

  for (let t = 0; t < trials; t++) {
    // Generate random valuations
    const valuations: number[] = [];
    for (let i = 0; i < n; i++) {
      if (distribution === 'uniform') {
        valuations.push(Math.random() * 100);
      } else if (distribution === 'exponential') {
        valuations.push(-Math.log(Math.random()) * 50);
      } else {
        // Normal with mean 50, std 15
        const u1 = Math.random();
        const u2 = Math.random();
        valuations.push(50 + 15 * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
      }
    }

    // Generate bids based on auction type
    let bids: number[];
    if (auctionType === 'second_price' || auctionType === 'english') {
      bids = valuations; // Truthful
    } else {
      bids = valuations.map(v => Math.max(0, v * (n - 1) / n)); // Strategic shading
    }

    // Run auction
    let result: AuctionResult;
    if (auctionType === 'first_price') {
      result = firstPriceAuction(valuations, bids, reservePrice);
    } else if (auctionType === 'second_price') {
      result = secondPriceAuction(valuations, bids, reservePrice);
    } else if (auctionType === 'english') {
      result = englishAuction(valuations, reservePrice);
    } else {
      result = dutchAuction(valuations, Math.max(...valuations) * 1.5);
    }

    revenues.push(result.revenue);
    surpluses.push(result.surplus);

    // Efficiency: did highest-value bidder win?
    const maxVal = Math.max(...valuations);
    const efficiency = result.winner >= 0 && valuations[result.winner] === maxVal ? 1 : 0;
    efficiencies.push(efficiency);
  }

  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / trials;
  const avgSurplus = surpluses.reduce((a, b) => a + b, 0) / trials;
  const avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / trials;

  const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avgRevenue, 2), 0) / trials;
  const revenueStdDev = Math.sqrt(variance);

  return {
    avgRevenue,
    avgWinnerSurplus: avgSurplus,
    avgEfficiency,
    revenueStdDev
  };
}

export async function executeauctiontheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    let result: any;

    switch (operation) {
      case 'info':
        result = {
          tool: 'auction-theory',
          description: 'Auction mechanism design and game-theoretic analysis',
          operations: [
            'info - Tool information',
            'simulate - Run auction simulation',
            'optimal_bid - Calculate optimal bidding strategy',
            'revenue_equivalence - Analyze revenue equivalence theorem',
            'vcg - VCG mechanism for multi-item auctions',
            'compare - Compare different auction formats',
            'strategy - Get bidding strategy advice',
            'demonstrate - Show comprehensive auction analysis'
          ],
          auctionTypes: {
            firstPrice: 'Sealed-bid, winner pays own bid',
            secondPrice: 'Vickrey - sealed-bid, winner pays second-highest',
            english: 'Ascending open outcry',
            dutch: 'Descending clock',
            allPay: 'Everyone pays, highest bid wins',
            vcg: 'Vickrey-Clarke-Groves mechanism'
          },
          keyTheorems: [
            'Revenue Equivalence: Standard auctions yield same expected revenue',
            'Myerson Optimal Auction: Reserve price can increase revenue',
            'VCG: Truthful, efficient, dominant strategy mechanism'
          ]
        };
        break;

      case 'simulate': {
        const auctionType = args.auction_type || 'second_price';
        const valuations = args.valuations || [100, 80, 60, 40];
        const bids = args.bids || valuations;
        const reservePrice = args.reserve_price || 0;

        let auctionResult: AuctionResult;

        if (auctionType === 'first_price') {
          auctionResult = firstPriceAuction(valuations, bids, reservePrice);
        } else if (auctionType === 'second_price') {
          auctionResult = secondPriceAuction(valuations, bids, reservePrice);
        } else if (auctionType === 'english') {
          auctionResult = englishAuction(valuations, reservePrice);
        } else if (auctionType === 'dutch') {
          auctionResult = dutchAuction(valuations, Math.max(...valuations) * 1.5);
        } else if (auctionType === 'all_pay') {
          auctionResult = allPayAuction(valuations, bids);
        } else {
          auctionResult = secondPriceAuction(valuations, bids, reservePrice);
        }

        const bidders: BidderInfo[] = valuations.map((v, i) => ({
          id: i,
          valuation: v,
          bid: bids[i],
          surplus: i === auctionResult.winner ? auctionResult.surplus : -((auctionType === 'all_pay') ? bids[i] : 0),
          isWinner: i === auctionResult.winner
        }));

        result = {
          auctionType,
          reservePrice,
          bidders,
          outcome: auctionResult,
          analysis: {
            winnerValuation: auctionResult.winner >= 0 ? valuations[auctionResult.winner] : null,
            profitMargin: auctionResult.winner >= 0 ?
              (auctionResult.surplus / valuations[auctionResult.winner] * 100).toFixed(2) + '%' : 'N/A',
            socialWelfare: auctionResult.winner >= 0 ? valuations[auctionResult.winner] : 0
          }
        };
        break;
      }

      case 'optimal_bid': {
        const value = args.value || 100;
        const n = args.bidders || 5;
        const distribution = args.distribution || 'uniform';

        const optimal = optimalFirstPriceBid(value, n, distribution);
        const strategy = strategyAnalysis('first_price', n, value);

        result = {
          privateValue: value,
          numBidders: n,
          distribution,
          optimalBid: optimal.optimalBid,
          bidShading: optimal.bidShading,
          shadingPercent: ((optimal.bidShading / value) * 100).toFixed(2) + '%',
          expectedPayoff: optimal.expectedPayoff,
          formula: optimal.formula,
          intuition: `With ${n} competitors, you shade by ${((1/n) * 100).toFixed(1)}% to balance win probability against profit.`,
          strategy: strategy.advice
        };
        break;
      }

      case 'revenue_equivalence': {
        const n = args.bidders || 5;
        const distribution = args.distribution || 'uniform';

        const analysis = revenueEquivalence(n, distribution);

        // Run simulations to verify
        const simResults: { [key: string]: any } = {};
        for (const auctionType of ['first_price', 'second_price', 'english', 'dutch']) {
          simResults[auctionType] = simulateAuction(auctionType, n, distribution, 0, 1000);
        }

        result = {
          numBidders: n,
          distribution,
          theoreticalRevenue: analysis.expectedRevenue,
          simulatedRevenue: Object.fromEntries(
            Object.entries(simResults).map(([k, v]) => [k, v.avgRevenue.toFixed(4)])
          ),
          conditions: analysis.conditions,
          explanation: analysis.explanation,
          note: 'Simulated values should converge to theoretical as trials increase'
        };
        break;
      }

      case 'vcg': {
        const items = args.items || [
          { name: 'Item A', bids: [100, 80, 60] },
          { name: 'Item B', bids: [50, 70, 40] }
        ];
        const bidderCount = args.bidders || 3;

        const vcgResult = vcgAuction(items, bidderCount);

        result = {
          mechanism: 'Vickrey-Clarke-Groves',
          properties: [
            'Truthful: Bidding true value is dominant strategy',
            'Efficient: Maximizes social welfare',
            'Individually Rational: Winners never pay more than value'
          ],
          allocation: vcgResult.allocation,
          totalRevenue: vcgResult.totalRevenue,
          explanation: 'VCG payment = harm bidder causes to others = value of next-best allocation'
        };
        break;
      }

      case 'compare': {
        const valuations = args.valuations || [100, 85, 70, 55, 40];
        const reservePrice = args.reserve_price || 0;

        const comparison = compareAuctions(valuations, reservePrice);

        result = {
          valuations,
          reservePrice,
          results: Object.fromEntries(
            Object.entries(comparison.results).map(([k, v]) => [k, {
              winner: `Bidder ${v.winner}`,
              payment: v.payment.toFixed(2),
              revenue: v.revenue.toFixed(2),
              surplus: v.surplus.toFixed(2)
            }])
          ),
          recommendation: comparison.recommendation
        };
        break;
      }

      case 'strategy': {
        const auctionType = args.auction_type || 'second_price';
        const n = args.bidders || 5;
        const value = args.value || 100;

        const analysis = strategyAnalysis(auctionType, n, value);

        result = {
          auctionType,
          numBidders: n,
          privateValue: value,
          optimalStrategy: analysis.strategy,
          dominantStrategy: analysis.dominantStrategy,
          equilibriumConcept: analysis.equilibrium,
          practicalAdvice: analysis.advice
        };
        break;
      }

      case 'demonstrate': {
        const n = 5;
        const valuations = [100, 87, 73, 58, 42];

        let demo = `
╔═══════════════════════════════════════════════════════════════════════╗
║                    AUCTION THEORY DEMONSTRATION                       ║
╚═══════════════════════════════════════════════════════════════════════╝

SCENARIO: Single-item auction with ${n} risk-neutral bidders
Private Valuations: [${valuations.join(', ')}]

═══════════════════════════════════════════════════════════════════════
                         AUCTION FORMATS
═══════════════════════════════════════════════════════════════════════

1. SECOND-PRICE SEALED-BID (VICKREY AUCTION)
   ──────────────────────────────────────────
   Strategy: Truthful bidding (b = v) is dominant

   Bids:    [${valuations.join(', ')}] (truthful)
   Winner:  Bidder 0 (value = 100)
   Payment: $87 (second-highest bid)
   Surplus: $13 (value - payment)

   ✓ Simple: No need to guess others' values
   ✓ Truthful: Can't do better by lying

2. FIRST-PRICE SEALED-BID
   ────────────────────────
   Strategy: Bid shading b(v) = ((n-1)/n) × v = 0.8v

   Optimal Bids: [${valuations.map(v => (v * 0.8).toFixed(0)).join(', ')}]
   Winner:  Bidder 0
   Payment: $80 (own bid)
   Surplus: $20

   Trade-off: Bid too low → lose, bid too high → no profit

3. ENGLISH (ASCENDING) AUCTION
   ────────────────────────────
   Price rises until one bidder remains

   Drop-out order: Bidder 4 ($42) → 3 ($58) → 2 ($73) → 1 ($87)
   Winner:  Bidder 0
   Payment: ~$87 (price when last competitor drops)

   Strategically equivalent to second-price

4. DUTCH (DESCENDING) AUCTION
   ───────────────────────────
   Price falls until someone accepts

   Clock starts: $150
   First acceptance: Bidder 0 at ~$80
   Payment: $80

   Strategically equivalent to first-price

═══════════════════════════════════════════════════════════════════════
                    REVENUE EQUIVALENCE THEOREM
═══════════════════════════════════════════════════════════════════════

For ${n} bidders with uniform[0,100] valuations:

  Expected Revenue = E[2nd highest value]
                   = (${n-1}/${n+1}) × 100
                   = ${((n-1)/(n+1) * 100).toFixed(2)}

  ┌──────────────────┬─────────────────┐
  │ Auction Type     │ Expected Revenue│
  ├──────────────────┼─────────────────┤
  │ First-Price      │ ${((n-1)/(n+1) * 100).toFixed(2)}          │
  │ Second-Price     │ ${((n-1)/(n+1) * 100).toFixed(2)}          │
  │ English          │ ${((n-1)/(n+1) * 100).toFixed(2)}          │
  │ Dutch            │ ${((n-1)/(n+1) * 100).toFixed(2)}          │
  └──────────────────┴─────────────────┘

CONDITIONS:
  ✓ Risk-neutral bidders
  ✓ Independent private values
  ✓ Symmetric bidders
  ✓ No collusion

═══════════════════════════════════════════════════════════════════════
                      OPTIMAL BIDDING IN FIRST-PRICE
═══════════════════════════════════════════════════════════════════════

For value v with ${n} uniform[0,1] bidders:

  Optimal bid: b(v) = (${n-1}/${n}) × v

  Example: v = 100
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Value          : $100.00                                            │
  │ Optimal Bid    : $${(100 * (n-1)/n).toFixed(2)}                                             │
  │ Bid Shading    : ${(100/n).toFixed(2)} (${(100/n).toFixed(1)}%)                                    │
  │ P(Win)         : ${Math.pow((n-1)/n, n-1).toFixed(4)}                                           │
  │ Expected Profit: $${(100 * Math.pow((n-1)/n, n-1) / n).toFixed(2)}                                            │
  └─────────────────────────────────────────────────────────────────────┘

  Intuition: With more bidders, shade less (more competition)
  n=2: shade 50%  │  n=5: shade 20%  │  n=10: shade 10%

═══════════════════════════════════════════════════════════════════════
                        VCG MECHANISM
═══════════════════════════════════════════════════════════════════════

Multi-item scenario: 2 items, 3 bidders

  Bidder   │ Item A │ Item B │ Package │
  ─────────┼────────┼────────┼─────────┤
  0        │  100   │   50   │   130   │
  1        │   80   │   70   │   140   │
  2        │   60   │   40   │    90   │

  Efficient Allocation:
  • Item A → Bidder 0 (highest value)
  • Item B → Bidder 1 (highest value)

  VCG Payments (= harm to others):
  • Bidder 0 pays: $80 (Bidder 1's value, next best)
  • Bidder 1 pays: $50 (Bidder 0's value, next best)

  Properties:
  ✓ Truthful mechanism
  ✓ Socially efficient
  ✓ Individual rationality

═══════════════════════════════════════════════════════════════════════
                    KEY INSIGHTS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│ 1. SECOND-PRICE is simpler for bidders (truthful is optimal)       │
│ 2. FIRST-PRICE requires strategic sophistication                   │
│ 3. RESERVE PRICE can increase seller revenue (Myerson)             │
│ 4. ALL-PAY auctions have high variance, risky for bidders          │
│ 5. VCG extends Vickrey to combinatorial settings                   │
│ 6. Collusion breaks revenue equivalence                            │
└─────────────────────────────────────────────────────────────────────┘
`;

        result = {
          demonstration: demo,
          summary: {
            bestForBidders: 'Second-price (simple truthful strategy)',
            bestForSeller: 'All equivalent under revenue equivalence conditions',
            mostCommon: 'English auction (transparency, excitement)',
            mostEfficient: 'VCG (for multi-item settings)'
          }
        };
        break;
      }

      default:
        result = { error: `Unknown operation: ${operation}`, availableOperations: ['info', 'simulate', 'optimal_bid', 'revenue_equivalence', 'vcg', 'compare', 'strategy', 'demonstrate'] };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isauctiontheoryAvailable(): boolean { return true; }
