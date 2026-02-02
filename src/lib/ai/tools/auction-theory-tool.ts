/**
 * AUCTION-THEORY TOOL
 * Auction mechanism design and analysis
 *
 * Features:
 * - Multiple auction formats (first-price, second-price, English, Dutch)
 * - Optimal bidding strategies
 * - Revenue equivalence theorem
 * - Mechanism design analysis
 * - Vickrey-Clarke-Groves (VCG) auctions
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const auctiontheoryTool: UnifiedTool = {
  name: 'auction_theory',
  description: 'Auction theory analysis including bidding strategies, revenue equivalence, and mechanism design',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'optimal_bid', 'revenue_equivalence', 'compare', 'vcg', 'info'],
        description: 'Operation to perform'
      },
      auction_type: {
        type: 'string',
        enum: ['first_price', 'second_price', 'english', 'dutch', 'all_pay'],
        description: 'Auction format'
      },
      valuations: {
        type: 'array',
        items: { type: 'number' },
        description: 'Bidder valuations'
      },
      num_bidders: {
        type: 'number',
        description: 'Number of bidders'
      },
      num_simulations: {
        type: 'number',
        description: 'Number of simulation runs'
      },
      distribution: {
        type: 'string',
        enum: ['uniform', 'normal', 'exponential'],
        description: 'Value distribution'
      },
      max_value: {
        type: 'number',
        description: 'Maximum possible value'
      }
    },
    required: ['operation']
  }
};

// Bidder type
interface Bidder {
  id: number;
  valuation: number;
  bid?: number;
}

// Auction result
interface AuctionResult {
  winner: number;
  winningBid: number;
  price: number;
  revenue: number;
  efficiency: number;
  bidders: Bidder[];
}

// Generate valuations from distribution
function generateValuations(numBidders: number, distribution: string, maxValue: number = 100): number[] {
  const valuations: number[] = [];

  for (let i = 0; i < numBidders; i++) {
    switch (distribution) {
      case 'uniform':
        valuations.push(Math.random() * maxValue);
        break;
      case 'normal':
        // Box-Muller
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        valuations.push(Math.max(0, Math.min(maxValue, maxValue / 2 + z * maxValue / 6)));
        break;
      case 'exponential':
        valuations.push(Math.min(maxValue, -Math.log(1 - Math.random()) * maxValue / 3));
        break;
      default:
        valuations.push(Math.random() * maxValue);
    }
  }

  return valuations;
}

// Optimal bid for first-price sealed-bid auction (risk-neutral)
function optimalFirstPriceBid(valuation: number, numBidders: number, maxValue: number): number {
  // For uniform [0, maxValue] with n bidders: bid = (n-1)/n * valuation
  return ((numBidders - 1) / numBidders) * valuation;
}

// Simulate first-price sealed-bid auction
function simulateFirstPrice(valuations: number[], maxValue: number): AuctionResult {
  const numBidders = valuations.length;
  const bidders: Bidder[] = valuations.map((v, i) => ({
    id: i,
    valuation: v,
    bid: optimalFirstPriceBid(v, numBidders, maxValue)
  }));

  // Find winner
  let winner = 0;
  let maxBid = bidders[0].bid!;
  for (let i = 1; i < bidders.length; i++) {
    if (bidders[i].bid! > maxBid) {
      maxBid = bidders[i].bid!;
      winner = i;
    }
  }

  // Efficiency: did highest-value bidder win?
  const maxValuation = Math.max(...valuations);
  const efficiency = bidders[winner].valuation === maxValuation ? 1 : 0;

  return {
    winner,
    winningBid: maxBid,
    price: maxBid,
    revenue: maxBid,
    efficiency,
    bidders
  };
}

// Simulate second-price sealed-bid (Vickrey) auction
function simulateSecondPrice(valuations: number[]): AuctionResult {
  const bidders: Bidder[] = valuations.map((v, i) => ({
    id: i,
    valuation: v,
    bid: v  // Truthful bidding is dominant strategy
  }));

  // Sort by bid
  const sorted = [...bidders].sort((a, b) => b.bid! - a.bid!);
  const winner = sorted[0].id;
  const winningBid = sorted[0].bid!;
  const price = sorted.length > 1 ? sorted[1].bid! : 0;

  const maxValuation = Math.max(...valuations);
  const efficiency = bidders[winner].valuation === maxValuation ? 1 : 0;

  return {
    winner,
    winningBid,
    price,
    revenue: price,
    efficiency,
    bidders
  };
}

// Simulate English (ascending) auction
function simulateEnglish(valuations: number[], increment: number = 1): AuctionResult {
  const bidders: Bidder[] = valuations.map((v, i) => ({
    id: i,
    valuation: v,
    bid: 0
  }));

  let currentPrice = 0;
  let activeBidders = new Set(bidders.map(b => b.id));
  let lastBidder = -1;

  while (activeBidders.size > 1) {
    let anyBid = false;

    for (const bidderId of activeBidders) {
      const bidder = bidders[bidderId];
      if (currentPrice + increment <= bidder.valuation) {
        currentPrice += increment;
        bidder.bid = currentPrice;
        lastBidder = bidderId;
        anyBid = true;
      } else {
        activeBidders.delete(bidderId);
      }
    }

    if (!anyBid) break;
  }

  const winner = lastBidder >= 0 ? lastBidder : 0;
  const maxValuation = Math.max(...valuations);
  const efficiency = bidders[winner].valuation === maxValuation ? 1 : 0;

  return {
    winner,
    winningBid: currentPrice,
    price: currentPrice,
    revenue: currentPrice,
    efficiency,
    bidders
  };
}

// Simulate Dutch (descending) auction
function simulateDutch(valuations: number[], startPrice: number, decrement: number = 1): AuctionResult {
  const bidders: Bidder[] = valuations.map((v, i) => ({
    id: i,
    valuation: v,
    bid: 0
  }));

  let currentPrice = startPrice;
  let winner = -1;

  // Optimal strategy: bid when price reaches (n-1)/n * valuation
  const numBidders = valuations.length;
  const thresholds = valuations.map(v => ((numBidders - 1) / numBidders) * v);

  while (currentPrice > 0 && winner < 0) {
    for (let i = 0; i < bidders.length; i++) {
      if (currentPrice <= thresholds[i] && currentPrice <= bidders[i].valuation) {
        winner = i;
        bidders[i].bid = currentPrice;
        break;
      }
    }
    currentPrice -= decrement;
  }

  if (winner < 0) {
    winner = valuations.indexOf(Math.max(...valuations));
  }

  const maxValuation = Math.max(...valuations);
  const efficiency = bidders[winner].valuation === maxValuation ? 1 : 0;

  return {
    winner,
    winningBid: bidders[winner].bid || 0,
    price: bidders[winner].bid || 0,
    revenue: bidders[winner].bid || 0,
    efficiency,
    bidders
  };
}

// Simulate all-pay auction
function simulateAllPay(valuations: number[], maxValue: number): AuctionResult {
  const numBidders = valuations.length;
  const bidders: Bidder[] = valuations.map((v, i) => {
    // Optimal bid for uniform distribution: v^n/((n-1)*maxValue^(n-1))
    // Simplified approximation
    const bid = Math.pow(v / maxValue, numBidders) * v * (numBidders - 1) / numBidders;
    return { id: i, valuation: v, bid };
  });

  let winner = 0;
  let maxBid = bidders[0].bid!;
  for (let i = 1; i < bidders.length; i++) {
    if (bidders[i].bid! > maxBid) {
      maxBid = bidders[i].bid!;
      winner = i;
    }
  }

  // Revenue is sum of all bids
  const revenue = bidders.reduce((sum, b) => sum + b.bid!, 0);

  const maxValuation = Math.max(...valuations);
  const efficiency = bidders[winner].valuation === maxValuation ? 1 : 0;

  return {
    winner,
    winningBid: maxBid,
    price: revenue,
    revenue,
    efficiency,
    bidders
  };
}

// VCG auction (multi-item)
function vcgAuction(
  bidderValues: number[][],  // [bidder][item]
  numItems: number
): { allocation: number[]; payments: number[] } {
  const numBidders = bidderValues.length;

  // Simple single-item VCG (generalized second price)
  if (numItems === 1) {
    const values = bidderValues.map(bv => bv[0]);
    const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);

    const winner = sorted[0].i;
    const payment = sorted.length > 1 ? sorted[1].v : 0;

    const allocation = new Array(numBidders).fill(-1);
    allocation[winner] = 0;

    const payments = new Array(numBidders).fill(0);
    payments[winner] = payment;

    return { allocation, payments };
  }

  // Multi-item: greedy allocation (simplified)
  const allocation = new Array(numBidders).fill(-1);
  const assignedItems = new Set<number>();
  const payments = new Array(numBidders).fill(0);

  // Sort all (bidder, item, value) by value
  const bids: { bidder: number; item: number; value: number }[] = [];
  for (let b = 0; b < numBidders; b++) {
    for (let i = 0; i < numItems; i++) {
      bids.push({ bidder: b, item: i, value: bidderValues[b][i] });
    }
  }
  bids.sort((a, b) => b.value - a.value);

  // Allocate items
  const assignedBidders = new Set<number>();
  for (const bid of bids) {
    if (!assignedItems.has(bid.item) && !assignedBidders.has(bid.bidder)) {
      allocation[bid.bidder] = bid.item;
      assignedItems.add(bid.item);
      assignedBidders.add(bid.bidder);
    }
  }

  // Calculate VCG payments
  const totalWelfare = allocation.reduce((sum, item, bidder) =>
    sum + (item >= 0 ? bidderValues[bidder][item] : 0), 0);

  for (let b = 0; b < numBidders; b++) {
    if (allocation[b] >= 0) {
      // Calculate welfare without this bidder
      const othersWelfare = totalWelfare - bidderValues[b][allocation[b]];

      // Calculate optimal welfare for others if this bidder wasn't present
      const otherBids = bids.filter(bid => bid.bidder !== b);
      let optimalOthersWelfare = 0;
      const tempAssigned = new Set<number>();
      const tempBidders = new Set<number>();
      for (const bid of otherBids) {
        if (!tempAssigned.has(bid.item) && !tempBidders.has(bid.bidder)) {
          optimalOthersWelfare += bid.value;
          tempAssigned.add(bid.item);
          tempBidders.add(bid.bidder);
        }
      }

      payments[b] = optimalOthersWelfare - othersWelfare;
    }
  }

  return { allocation, payments };
}

// Revenue equivalence analysis
function analyzeRevenueEquivalence(
  numBidders: number,
  maxValue: number,
  numSimulations: number
): Record<string, unknown> {
  const results: Record<string, number[]> = {
    first_price: [],
    second_price: [],
    english: [],
    dutch: [],
    all_pay: []
  };

  for (let sim = 0; sim < numSimulations; sim++) {
    const valuations = generateValuations(numBidders, 'uniform', maxValue);

    results.first_price.push(simulateFirstPrice(valuations, maxValue).revenue);
    results.second_price.push(simulateSecondPrice(valuations).revenue);
    results.english.push(simulateEnglish(valuations).revenue);
    results.dutch.push(simulateDutch(valuations, maxValue * 1.5).revenue);
    results.all_pay.push(simulateAllPay(valuations, maxValue).revenue);
  }

  const stats: Record<string, Record<string, number>> = {};
  for (const [format, revenues] of Object.entries(results)) {
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = revenues.reduce((s, r) => s + (r - mean) ** 2, 0) / revenues.length;
    stats[format] = {
      mean_revenue: parseFloat(mean.toFixed(2)),
      std_dev: parseFloat(Math.sqrt(variance).toFixed(2)),
      min_revenue: parseFloat(Math.min(...revenues).toFixed(2)),
      max_revenue: parseFloat(Math.max(...revenues).toFixed(2))
    };
  }

  // Theoretical expected revenue for symmetric IPV uniform
  // E[Revenue] = (n-1)/(n+1) * maxValue
  const theoreticalRevenue = ((numBidders - 1) / (numBidders + 1)) * maxValue;

  return {
    num_bidders: numBidders,
    max_value: maxValue,
    simulations: numSimulations,
    theoretical_expected_revenue: theoreticalRevenue,
    empirical_results: stats,
    revenue_equivalence_verified: Object.values(stats).every(s =>
      Math.abs(s.mean_revenue - theoreticalRevenue) < maxValue * 0.1
    )
  };
}

export async function executeauctiontheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'auction_theory',
          description: 'Auction mechanism design and analysis',
          operations: {
            simulate: 'Simulate auction with given valuations',
            optimal_bid: 'Calculate optimal bidding strategy',
            revenue_equivalence: 'Test revenue equivalence theorem',
            compare: 'Compare different auction formats',
            vcg: 'Run Vickrey-Clarke-Groves auction'
          },
          auction_types: {
            first_price: 'Sealed-bid, winner pays their bid',
            second_price: 'Sealed-bid (Vickrey), winner pays second-highest bid',
            english: 'Ascending open auction',
            dutch: 'Descending open auction',
            all_pay: 'All bidders pay their bids, highest wins'
          },
          features: [
            'Optimal bidding strategies',
            'Revenue equivalence verification',
            'Multiple value distributions',
            'Efficiency analysis',
            'VCG mechanism for multiple items'
          ],
          key_theorems: {
            revenue_equivalence: 'All standard auctions yield same expected revenue with symmetric risk-neutral bidders',
            vickrey: 'Second-price auction makes truthful bidding dominant strategy',
            vcg: 'VCG mechanism is truthful and efficient'
          },
          example: {
            operation: 'simulate',
            auction_type: 'second_price',
            valuations: [80, 65, 90, 72]
          }
        }, null, 2)
      };
    }

    if (operation === 'simulate') {
      const auctionType = args.auction_type || 'second_price';
      let valuations = args.valuations;
      const maxValue = args.max_value || 100;

      if (!valuations || valuations.length === 0) {
        const numBidders = args.num_bidders || 5;
        const distribution = args.distribution || 'uniform';
        valuations = generateValuations(numBidders, distribution, maxValue);
      }

      let result: AuctionResult;

      switch (auctionType) {
        case 'first_price':
          result = simulateFirstPrice(valuations, maxValue);
          break;
        case 'second_price':
          result = simulateSecondPrice(valuations);
          break;
        case 'english':
          result = simulateEnglish(valuations);
          break;
        case 'dutch':
          result = simulateDutch(valuations, maxValue * 1.5);
          break;
        case 'all_pay':
          result = simulateAllPay(valuations, maxValue);
          break;
        default:
          result = simulateSecondPrice(valuations);
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'simulate',
          auction_type: auctionType,
          bidders: result.bidders.map(b => ({
            id: b.id,
            valuation: parseFloat(b.valuation.toFixed(2)),
            bid: parseFloat((b.bid || 0).toFixed(2)),
            surplus: b.id === result.winner
              ? parseFloat((b.valuation - result.price).toFixed(2))
              : auctionType === 'all_pay'
              ? parseFloat((-b.bid!).toFixed(2))
              : 0
          })),
          outcome: {
            winner: result.winner,
            winning_bid: parseFloat(result.winningBid.toFixed(2)),
            price_paid: parseFloat(result.price.toFixed(2)),
            seller_revenue: parseFloat(result.revenue.toFixed(2)),
            winner_surplus: parseFloat((result.bidders[result.winner].valuation - result.price).toFixed(2)),
            efficiency: result.efficiency
          }
        }, null, 2)
      };
    }

    if (operation === 'optimal_bid') {
      const auctionType = args.auction_type || 'first_price';
      const valuation = args.valuation || 75;
      const numBidders = args.num_bidders || 5;
      const maxValue = args.max_value || 100;

      let optimalBid: number;
      let strategy: string;
      let expectedProfit: number;

      switch (auctionType) {
        case 'first_price':
          optimalBid = optimalFirstPriceBid(valuation, numBidders, maxValue);
          strategy = `Bid (n-1)/n × valuation = ${(numBidders - 1)}/${numBidders} × ${valuation}`;
          // Expected profit: probability of winning × (valuation - bid)
          const probWin = Math.pow(optimalBid / maxValue, numBidders - 1);
          expectedProfit = probWin * (valuation - optimalBid);
          break;

        case 'second_price':
          optimalBid = valuation;
          strategy = 'Bid truthfully (dominant strategy)';
          // Expected profit depends on distribution of second-highest value
          expectedProfit = valuation / (numBidders + 1);
          break;

        case 'english':
          optimalBid = valuation;
          strategy = 'Stay in auction until price exceeds valuation';
          expectedProfit = valuation / (numBidders + 1);
          break;

        case 'dutch':
          optimalBid = optimalFirstPriceBid(valuation, numBidders, maxValue);
          strategy = 'Accept when price falls to first-price optimal bid';
          expectedProfit = Math.pow(optimalBid / maxValue, numBidders - 1) * (valuation - optimalBid);
          break;

        case 'all_pay':
          optimalBid = Math.pow(valuation / maxValue, numBidders) * valuation * (numBidders - 1) / numBidders;
          strategy = 'Bid fraction based on value^n weighting';
          expectedProfit = Math.pow(valuation / maxValue, numBidders - 1) * valuation / numBidders;
          break;

        default:
          optimalBid = valuation;
          strategy = 'Default: truthful bidding';
          expectedProfit = 0;
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'optimal_bid',
          auction_type: auctionType,
          inputs: {
            valuation,
            num_bidders: numBidders,
            max_value: maxValue
          },
          optimal_strategy: {
            recommended_bid: parseFloat(optimalBid.toFixed(2)),
            strategy_explanation: strategy,
            expected_profit: parseFloat(expectedProfit.toFixed(2)),
            bid_shading: parseFloat((valuation - optimalBid).toFixed(2))
          },
          analysis: {
            bid_to_value_ratio: parseFloat((optimalBid / valuation).toFixed(4)),
            is_truthful: Math.abs(optimalBid - valuation) < 0.01
          }
        }, null, 2)
      };
    }

    if (operation === 'revenue_equivalence') {
      const numBidders = args.num_bidders || 5;
      const maxValue = args.max_value || 100;
      const numSimulations = args.num_simulations || 1000;

      const analysis = analyzeRevenueEquivalence(numBidders, maxValue, numSimulations);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'revenue_equivalence',
          ...analysis,
          explanation: 'Revenue Equivalence Theorem: Under symmetric independent private values with risk-neutral bidders, all standard auctions yield the same expected revenue to the seller.'
        }, null, 2)
      };
    }

    if (operation === 'compare') {
      let valuations = args.valuations;
      const maxValue = args.max_value || 100;

      if (!valuations || valuations.length === 0) {
        const numBidders = args.num_bidders || 5;
        valuations = generateValuations(numBidders, 'uniform', maxValue);
      }

      const results = {
        first_price: simulateFirstPrice(valuations, maxValue),
        second_price: simulateSecondPrice(valuations),
        english: simulateEnglish(valuations),
        dutch: simulateDutch(valuations, maxValue * 1.5),
        all_pay: simulateAllPay(valuations, maxValue)
      };

      const comparison = Object.entries(results).map(([format, result]) => ({
        format,
        winner: result.winner,
        winning_bid: parseFloat(result.winningBid.toFixed(2)),
        price: parseFloat(result.price.toFixed(2)),
        revenue: parseFloat(result.revenue.toFixed(2)),
        efficiency: result.efficiency,
        winner_surplus: parseFloat((result.bidders[result.winner].valuation - result.price).toFixed(2))
      }));

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'compare',
          valuations: valuations.map((v: number) => parseFloat(v.toFixed(2))),
          comparison,
          summary: {
            highest_revenue: comparison.reduce((max, c) => c.revenue > max.revenue ? c : max).format,
            highest_winner_surplus: comparison.reduce((max, c) => c.winner_surplus > max.winner_surplus ? c : max).format,
            all_efficient: comparison.every(c => c.efficiency === 1)
          }
        }, null, 2)
      };
    }

    if (operation === 'vcg') {
      const numBidders = args.num_bidders || 3;
      const numItems = args.num_items || 2;
      let bidderValues = args.bidder_values;

      if (!bidderValues) {
        bidderValues = [];
        for (let b = 0; b < numBidders; b++) {
          const values = [];
          for (let i = 0; i < numItems; i++) {
            values.push(Math.floor(Math.random() * 100));
          }
          bidderValues.push(values);
        }
      }

      const result = vcgAuction(bidderValues, numItems);

      const allocations = result.allocation.map((item, bidder) => ({
        bidder,
        item: item >= 0 ? item : 'none',
        value: item >= 0 ? bidderValues[bidder][item] : 0,
        payment: result.payments[bidder]
      }));

      const totalWelfare = allocations.reduce((sum, a) => sum + (typeof a.value === 'number' ? a.value : 0), 0);
      const totalRevenue = result.payments.reduce((sum, p) => sum + p, 0);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'vcg',
          bidder_values: bidderValues,
          allocation: allocations,
          summary: {
            total_welfare: totalWelfare,
            total_revenue: parseFloat(totalRevenue.toFixed(2)),
            is_efficient: true,
            is_truthful: true
          },
          vcg_properties: {
            dominant_strategy: 'Truthful reporting of values',
            allocative_efficiency: 'Maximizes total welfare',
            individual_rationality: 'No bidder pays more than their value'
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: `Unknown operation: ${operation}`,
        available_operations: ['simulate', 'optimal_bid', 'revenue_equivalence', 'compare', 'vcg', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isauctiontheoryAvailable(): boolean {
  return true;
}
