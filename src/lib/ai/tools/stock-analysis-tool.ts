/**
 * STOCK ANALYSIS TOOL
 * Technical analysis, indicators, and market simulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface OHLCV { date: string; open: number; high: number; low: number; close: number; volume: number; }
interface TechnicalIndicators { sma: number[]; ema: number[]; rsi: number; macd: { macd: number; signal: number; histogram: number }; bollingerBands: { upper: number; middle: number; lower: number }; }

function generateMockPriceData(days: number, startPrice: number = 100): OHLCV[] {
  const data: OHLCV[] = [];
  let price = startPrice;
  const date = new Date();
  date.setDate(date.getDate() - days);

  for (let i = 0; i < days; i++) {
    const volatility = 0.02;
    const drift = 0.0002;
    const change = price * (drift + volatility * (Math.random() - 0.5));
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      date: new Date(date).toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume
    });

    price = close;
    date.setDate(date.getDate() + 1);
  }
  return data;
}

function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(Math.round((sum / period) * 100) / 100);
  }
  return sma;
}

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  ema.push(prices.slice(0, period).reduce((a, b) => a + b, 0) / period);

  for (let i = period; i < prices.length; i++) {
    ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }
  return ema.map(v => Math.round(v * 100) / 100);
}

function calculateRSI(prices: number[], period: number = 14): number {
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - (100 / (1 + rs))) * 100) / 100;
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const signalLine = macdLine * 0.9;
  return {
    macd: Math.round(macdLine * 100) / 100,
    signal: Math.round(signalLine * 100) / 100,
    histogram: Math.round((macdLine - signalLine) * 100) / 100
  };
}

function calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
  const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
  const variance = prices.slice(-period).reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: Math.round((sma + 2 * stdDev) * 100) / 100,
    middle: Math.round(sma * 100) / 100,
    lower: Math.round((sma - 2 * stdDev) * 100) / 100
  };
}

function detectPatterns(data: OHLCV[]): string[] {
  const patterns: string[] = [];
  const recent = data.slice(-5);

  // Doji detection
  const last = recent[recent.length - 1];
  if (Math.abs(last.open - last.close) < (last.high - last.low) * 0.1) {
    patterns.push('Doji (indecision)');
  }

  // Hammer detection
  const body = Math.abs(last.open - last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  if (lowerWick > body * 2 && (last.high - Math.max(last.open, last.close)) < body * 0.5) {
    patterns.push('Hammer (potential reversal)');
  }

  // Three white soldiers
  const lastThree = recent.slice(-3);
  if (lastThree.every((d, i) => i === 0 || d.close > lastThree[i - 1].close) &&
      lastThree.every(d => d.close > d.open)) {
    patterns.push('Three White Soldiers (bullish)');
  }

  // Trend detection
  const closes = data.slice(-10).map(d => d.close);
  const trend = closes[closes.length - 1] - closes[0];
  if (trend > 0) patterns.push(`Uptrend (+${(trend / closes[0] * 100).toFixed(2)}%)`);
  else patterns.push(`Downtrend (${(trend / closes[0] * 100).toFixed(2)}%)`);

  return patterns;
}

function priceToAscii(data: OHLCV[], width: number = 60, height: number = 15): string {
  const closes = data.map(d => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));
  const step = Math.max(1, Math.floor(closes.length / width));

  for (let x = 0; x < width && x * step < closes.length; x++) {
    const price = closes[x * step];
    const y = height - 1 - Math.floor(((price - min) / range) * (height - 1));
    if (y >= 0 && y < height) grid[y][x] = '*';
  }

  const lines: string[] = [];
  lines.push(`$${max.toFixed(2).padStart(8)} ┤${grid[0].join('')}`);
  for (let i = 1; i < height - 1; i++) lines.push(`${''.padStart(9)} │${grid[i].join('')}`);
  lines.push(`$${min.toFixed(2).padStart(8)} ┤${grid[height - 1].join('')}`);
  lines.push(`${''.padStart(10)}└${'─'.repeat(width)}`);

  return lines.join('\n');
}

function generateSignal(indicators: TechnicalIndicators, price: number): { signal: 'BUY' | 'SELL' | 'HOLD'; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (indicators.rsi < 30) { score += 2; reasons.push('RSI oversold'); }
  else if (indicators.rsi > 70) { score -= 2; reasons.push('RSI overbought'); }

  if (indicators.macd.histogram > 0) { score += 1; reasons.push('MACD bullish'); }
  else { score -= 1; reasons.push('MACD bearish'); }

  if (price < indicators.bollingerBands.lower) { score += 1; reasons.push('Below lower Bollinger'); }
  else if (price > indicators.bollingerBands.upper) { score -= 1; reasons.push('Above upper Bollinger'); }

  const signal = score >= 2 ? 'BUY' : score <= -2 ? 'SELL' : 'HOLD';
  const confidence = Math.min(100, Math.abs(score) * 25);

  return { signal, confidence, reasons };
}

export const stockAnalysisTool: UnifiedTool = {
  name: 'stock_analysis',
  description: 'Stock Analysis: price_data, sma, ema, rsi, macd, bollinger, patterns, signal, chart',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['price_data', 'sma', 'ema', 'rsi', 'macd', 'bollinger', 'patterns', 'signal', 'chart', 'full_analysis', 'info'] },
      days: { type: 'number' },
      period: { type: 'number' },
      startPrice: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeStockAnalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    const data = generateMockPriceData(args.days || 100, args.startPrice || 100);
    const closes = data.map(d => d.close);

    switch (args.operation) {
      case 'price_data':
        result = { data: data.slice(-10), summary: { first: data[0].close, last: data[data.length - 1].close, change: ((data[data.length - 1].close - data[0].close) / data[0].close * 100).toFixed(2) + '%' } };
        break;
      case 'sma':
        result = { sma: calculateSMA(closes, args.period || 20).slice(-10), period: args.period || 20 };
        break;
      case 'ema':
        result = { ema: calculateEMA(closes, args.period || 20).slice(-10), period: args.period || 20 };
        break;
      case 'rsi':
        result = { rsi: calculateRSI(closes, args.period || 14), interpretation: calculateRSI(closes) > 70 ? 'Overbought' : calculateRSI(closes) < 30 ? 'Oversold' : 'Neutral' };
        break;
      case 'macd':
        result = { macd: calculateMACD(closes), interpretation: calculateMACD(closes).histogram > 0 ? 'Bullish' : 'Bearish' };
        break;
      case 'bollinger':
        result = { bollingerBands: calculateBollingerBands(closes, args.period || 20), currentPrice: closes[closes.length - 1] };
        break;
      case 'patterns':
        result = { patterns: detectPatterns(data) };
        break;
      case 'signal':
        const indicators: TechnicalIndicators = {
          sma: calculateSMA(closes, 20),
          ema: calculateEMA(closes, 20),
          rsi: calculateRSI(closes),
          macd: calculateMACD(closes),
          bollingerBands: calculateBollingerBands(closes)
        };
        result = generateSignal(indicators, closes[closes.length - 1]);
        break;
      case 'chart':
        result = { chart: priceToAscii(data, 60, 15), period: `${args.days || 100} days` };
        break;
      case 'full_analysis':
        const fullIndicators: TechnicalIndicators = {
          sma: calculateSMA(closes, 20),
          ema: calculateEMA(closes, 20),
          rsi: calculateRSI(closes),
          macd: calculateMACD(closes),
          bollingerBands: calculateBollingerBands(closes)
        };
        result = {
          currentPrice: closes[closes.length - 1],
          indicators: {
            rsi: fullIndicators.rsi,
            macd: fullIndicators.macd,
            bollinger: fullIndicators.bollingerBands,
            sma20: fullIndicators.sma[fullIndicators.sma.length - 1],
            ema20: fullIndicators.ema[fullIndicators.ema.length - 1]
          },
          patterns: detectPatterns(data),
          signal: generateSignal(fullIndicators, closes[closes.length - 1]),
          chart: priceToAscii(data)
        };
        break;
      case 'info':
        result = {
          description: 'Technical stock analysis and indicators',
          indicators: ['SMA', 'EMA', 'RSI', 'MACD', 'Bollinger Bands'],
          patterns: ['Doji', 'Hammer', 'Three White Soldiers', 'Trend'],
          signals: ['BUY', 'SELL', 'HOLD']
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isStockAnalysisAvailable(): boolean { return true; }
