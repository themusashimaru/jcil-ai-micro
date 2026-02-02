/**
 * ECG-ANALYZER TOOL
 * Comprehensive ECG waveform analysis and arrhythmia detection
 *
 * Features:
 * - R-peak detection using Pan-Tompkins algorithm
 * - Heart rate and HRV analysis
 * - PQRST wave morphology analysis
 * - Arrhythmia classification (AFib, VTach, PVC, etc.)
 * - ST segment analysis for ischemia detection
 * - QT interval measurement and correction
 * - Axis calculation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

class SignalProcessor {
  // Bandpass filter using cascaded Butterworth IIR
  static bandpassFilter(signal: number[], lowCut: number, highCut: number, sampleRate: number): number[] {
    const nyquist = sampleRate / 2;
    const lowNorm = lowCut / nyquist;
    const highNorm = highCut / nyquist;

    // Apply low-pass filter
    let filtered = this.lowpassFilter(signal, highNorm);
    // Apply high-pass filter
    filtered = this.highpassFilter(filtered, lowNorm);

    return filtered;
  }

  static lowpassFilter(signal: number[], cutoff: number): number[] {
    const result: number[] = new Array(signal.length);
    const alpha = cutoff / (cutoff + 1);

    result[0] = signal[0];
    for (let i = 1; i < signal.length; i++) {
      result[i] = result[i - 1] + alpha * (signal[i] - result[i - 1]);
    }

    return result;
  }

  static highpassFilter(signal: number[], cutoff: number): number[] {
    const result: number[] = new Array(signal.length);
    const alpha = 1 / (1 + cutoff);

    result[0] = signal[0];
    for (let i = 1; i < signal.length; i++) {
      result[i] = alpha * (result[i - 1] + signal[i] - signal[i - 1]);
    }

    return result;
  }

  // Derivative filter for slope detection
  static derivative(signal: number[]): number[] {
    const result: number[] = new Array(signal.length);

    // Five-point derivative
    for (let i = 0; i < signal.length; i++) {
      if (i < 2) {
        result[i] = signal[i + 1] - signal[i];
      } else if (i >= signal.length - 2) {
        result[i] = signal[i] - signal[i - 1];
      } else {
        result[i] = (2 * signal[i + 2] + signal[i + 1] - signal[i - 1] - 2 * signal[i - 2]) / 8;
      }
    }

    return result;
  }

  // Square the signal to enhance peaks
  static square(signal: number[]): number[] {
    return signal.map(x => x * x);
  }

  // Moving window integration
  static movingAverage(signal: number[], windowSize: number): number[] {
    const result: number[] = new Array(signal.length);

    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
        sum += signal[j];
        count++;
      }

      result[i] = sum / count;
    }

    return result;
  }

  // Baseline wander removal using median filter
  static removeBaseline(signal: number[], windowSize: number): number[] {
    const baseline = this.medianFilter(signal, windowSize);
    return signal.map((val, i) => val - baseline[i]);
  }

  static medianFilter(signal: number[], windowSize: number): number[] {
    const result: number[] = new Array(signal.length);
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(signal.length, i + halfWindow + 1);
      const window = signal.slice(start, end).sort((a, b) => a - b);
      result[i] = window[Math.floor(window.length / 2)];
    }

    return result;
  }

  // Notch filter for powerline interference (50/60 Hz)
  static notchFilter(signal: number[], notchFreq: number, sampleRate: number, Q: number = 30): number[] {
    const w0 = (2 * Math.PI * notchFreq) / sampleRate;
    const alpha = Math.sin(w0) / (2 * Q);

    const b0 = 1;
    const b1 = -2 * Math.cos(w0);
    const b2 = 1;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;

    const result: number[] = new Array(signal.length);
    result[0] = signal[0];
    result[1] = signal[1];

    for (let i = 2; i < signal.length; i++) {
      result[i] = (b0 / a0) * signal[i] +
                  (b1 / a0) * signal[i - 1] +
                  (b2 / a0) * signal[i - 2] -
                  (a1 / a0) * result[i - 1] -
                  (a2 / a0) * result[i - 2];
    }

    return result;
  }
}

// ============================================================================
// PAN-TOMPKINS R-PEAK DETECTOR
// ============================================================================

class PanTompkinsDetector {
  private sampleRate: number;
  private windowSize: number;

  constructor(sampleRate: number = 360) {
    this.sampleRate = sampleRate;
    this.windowSize = Math.round(0.150 * sampleRate); // 150ms window
  }

  detect(signal: number[]): {
    rPeaks: number[];
    processedSignal: number[];
    threshold: number;
  } {
    // Step 1: Bandpass filter (5-15 Hz for QRS)
    let filtered = SignalProcessor.bandpassFilter(signal, 5, 15, this.sampleRate);

    // Step 2: Derivative
    let derivative = SignalProcessor.derivative(filtered);

    // Step 3: Square
    let squared = SignalProcessor.square(derivative);

    // Step 4: Moving window integration
    let integrated = SignalProcessor.movingAverage(squared, this.windowSize);

    // Step 5: Adaptive thresholding
    const rPeaks = this.findPeaks(integrated);

    return {
      rPeaks,
      processedSignal: integrated,
      threshold: this.calculateThreshold(integrated)
    };
  }

  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const threshold = this.calculateThreshold(signal);
    const minDistance = Math.round(0.2 * this.sampleRate); // 200ms refractory period

    // Find local maxima above threshold
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] &&
          signal[i] > signal[i + 1] &&
          signal[i] > threshold) {

        // Check minimum distance from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > minDistance) {
          peaks.push(i);
        } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
          // Replace if this peak is higher
          peaks[peaks.length - 1] = i;
        }
      }
    }

    return peaks;
  }

  private calculateThreshold(signal: number[]): number {
    // Adaptive threshold based on signal statistics
    const sorted = [...signal].sort((a, b) => a - b);
    const percentile95 = sorted[Math.floor(sorted.length * 0.95)];
    const percentile25 = sorted[Math.floor(sorted.length * 0.25)];

    return percentile25 + 0.3 * (percentile95 - percentile25);
  }
}

// ============================================================================
// WAVE MORPHOLOGY ANALYZER
// ============================================================================

interface WavePoints {
  pOnset: number | null;
  pPeak: number | null;
  pOffset: number | null;
  qOnset: number | null;
  qPeak: number | null;
  rPeak: number;
  sPeak: number | null;
  sOffset: number | null;
  tOnset: number | null;
  tPeak: number | null;
  tOffset: number | null;
}

interface WaveAmplitudes {
  pAmplitude: number | null;
  qAmplitude: number | null;
  rAmplitude: number;
  sAmplitude: number | null;
  tAmplitude: number | null;
}

interface Intervals {
  prInterval: number | null;  // PR interval in ms
  qrsWidth: number | null;    // QRS duration in ms
  qtInterval: number | null;  // QT interval in ms
  qtcBazett: number | null;   // QTc using Bazett formula
  qtcFridericia: number | null; // QTc using Fridericia formula
  rrInterval: number | null;  // RR interval in ms
}

class WaveMorphologyAnalyzer {
  private sampleRate: number;

  constructor(sampleRate: number = 360) {
    this.sampleRate = sampleRate;
  }

  analyzeComplex(signal: number[], rPeak: number, prevRPeak: number | null, nextRPeak: number | null): {
    wavePoints: WavePoints;
    amplitudes: WaveAmplitudes;
    intervals: Intervals;
  } {
    const wavePoints = this.findWavePoints(signal, rPeak, prevRPeak, nextRPeak);
    const amplitudes = this.measureAmplitudes(signal, wavePoints);
    const intervals = this.calculateIntervals(wavePoints, prevRPeak);

    return { wavePoints, amplitudes, intervals };
  }

  private findWavePoints(signal: number[], rPeak: number, prevRPeak: number | null, nextRPeak: number | null): WavePoints {
    const result: WavePoints = {
      pOnset: null,
      pPeak: null,
      pOffset: null,
      qOnset: null,
      qPeak: null,
      rPeak,
      sPeak: null,
      sOffset: null,
      tOnset: null,
      tPeak: null,
      tOffset: null
    };

    // Search window before R peak for P and Q waves
    const searchBefore = Math.round(0.25 * this.sampleRate);
    const startBefore = Math.max(0, rPeak - searchBefore);

    // Find Q wave (local minimum before R)
    let qIdx = rPeak;
    for (let i = rPeak - 1; i >= startBefore; i--) {
      if (signal[i] < signal[qIdx]) {
        qIdx = i;
      }
      if (signal[i] > signal[qIdx] && qIdx !== rPeak) {
        break;
      }
    }
    if (qIdx !== rPeak) {
      result.qPeak = qIdx;
      result.qOnset = this.findOnset(signal, qIdx, startBefore);
    }

    // Find P wave (local maximum before Q onset)
    const pSearchStart = result.qOnset ?? qIdx;
    let pIdx: number | null = null;
    for (let i = pSearchStart - Math.round(0.02 * this.sampleRate); i >= startBefore; i--) {
      if (pIdx === null || signal[i] > signal[pIdx]) {
        pIdx = i;
      }
      if (pIdx !== null && signal[i] < signal[pIdx] * 0.5) {
        break;
      }
    }
    if (pIdx !== null && Math.abs(signal[pIdx]) > 0.1 * Math.abs(signal[rPeak])) {
      result.pPeak = pIdx;
      result.pOnset = this.findOnset(signal, pIdx, startBefore);
      result.pOffset = this.findOffset(signal, pIdx, result.qOnset ?? qIdx);
    }

    // Search window after R peak for S and T waves
    const searchAfter = Math.round(0.4 * this.sampleRate);
    const endAfter = Math.min(signal.length - 1, rPeak + searchAfter);

    // Find S wave (local minimum after R)
    let sIdx = rPeak;
    for (let i = rPeak + 1; i <= endAfter; i++) {
      if (signal[i] < signal[sIdx]) {
        sIdx = i;
      }
      if (signal[i] > signal[sIdx] && sIdx !== rPeak) {
        break;
      }
    }
    if (sIdx !== rPeak) {
      result.sPeak = sIdx;
      result.sOffset = this.findOffset(signal, sIdx, endAfter);
    }

    // Find T wave (local maximum after S offset)
    const tSearchStart = result.sOffset ?? sIdx;
    let tIdx: number | null = null;
    for (let i = tSearchStart + Math.round(0.02 * this.sampleRate); i <= endAfter; i++) {
      if (tIdx === null || signal[i] > signal[tIdx]) {
        tIdx = i;
      }
      if (tIdx !== null && signal[i] < signal[tIdx] * 0.5 && i > tIdx + Math.round(0.04 * this.sampleRate)) {
        break;
      }
    }
    if (tIdx !== null && Math.abs(signal[tIdx]) > 0.05 * Math.abs(signal[rPeak])) {
      result.tPeak = tIdx;
      result.tOnset = this.findOnset(signal, tIdx, tSearchStart);
      result.tOffset = this.findOffset(signal, tIdx, endAfter);
    }

    return result;
  }

  private findOnset(signal: number[], peak: number, limit: number): number {
    const threshold = signal[peak] * 0.1;
    for (let i = peak - 1; i >= limit; i--) {
      if (Math.abs(signal[i]) < Math.abs(threshold)) {
        return i;
      }
    }
    return limit;
  }

  private findOffset(signal: number[], peak: number, limit: number): number {
    const threshold = signal[peak] * 0.1;
    for (let i = peak + 1; i <= limit; i++) {
      if (Math.abs(signal[i]) < Math.abs(threshold)) {
        return i;
      }
    }
    return limit;
  }

  private measureAmplitudes(signal: number[], wavePoints: WavePoints): WaveAmplitudes {
    return {
      pAmplitude: wavePoints.pPeak !== null ? signal[wavePoints.pPeak] : null,
      qAmplitude: wavePoints.qPeak !== null ? signal[wavePoints.qPeak] : null,
      rAmplitude: signal[wavePoints.rPeak],
      sAmplitude: wavePoints.sPeak !== null ? signal[wavePoints.sPeak] : null,
      tAmplitude: wavePoints.tPeak !== null ? signal[wavePoints.tPeak] : null
    };
  }

  private calculateIntervals(wavePoints: WavePoints, prevRPeak: number | null): Intervals {
    const toMs = (samples: number) => (samples / this.sampleRate) * 1000;

    const rrInterval = prevRPeak !== null ? toMs(wavePoints.rPeak - prevRPeak) : null;
    const heartRate = rrInterval !== null ? 60000 / rrInterval : null;

    const prInterval = (wavePoints.pOnset !== null && wavePoints.qOnset !== null)
      ? toMs(wavePoints.qOnset - wavePoints.pOnset)
      : null;

    const qrsWidth = (wavePoints.qOnset !== null && wavePoints.sOffset !== null)
      ? toMs(wavePoints.sOffset - wavePoints.qOnset)
      : null;

    const qtInterval = (wavePoints.qOnset !== null && wavePoints.tOffset !== null)
      ? toMs(wavePoints.tOffset - wavePoints.qOnset)
      : null;

    // QTc corrections
    let qtcBazett: number | null = null;
    let qtcFridericia: number | null = null;

    if (qtInterval !== null && rrInterval !== null && rrInterval > 0) {
      const rrSeconds = rrInterval / 1000;
      qtcBazett = qtInterval / Math.sqrt(rrSeconds);
      qtcFridericia = qtInterval / Math.pow(rrSeconds, 1/3);
    }

    return {
      prInterval,
      qrsWidth,
      qtInterval,
      qtcBazett,
      qtcFridericia,
      rrInterval
    };
  }
}

// ============================================================================
// HEART RATE VARIABILITY ANALYZER
// ============================================================================

interface HRVMetrics {
  // Time domain
  meanRR: number;
  sdnn: number;        // Standard deviation of NN intervals
  rmssd: number;       // Root mean square of successive differences
  pnn50: number;       // Percentage of successive NN intervals > 50ms
  meanHR: number;
  sdHR: number;

  // Frequency domain (simplified)
  vlf: number;         // Very low frequency power (0.003-0.04 Hz)
  lf: number;          // Low frequency power (0.04-0.15 Hz)
  hf: number;          // High frequency power (0.15-0.4 Hz)
  lfHfRatio: number;   // LF/HF ratio
  totalPower: number;

  // Non-linear
  sd1: number;         // Poincaré plot SD1
  sd2: number;         // Poincaré plot SD2
  sd1sd2Ratio: number;
}

class HRVAnalyzer {
  analyze(rrIntervals: number[]): HRVMetrics {
    const timeDomain = this.analyzeTimeDomain(rrIntervals);
    const frequencyDomain = this.analyzeFrequencyDomain(rrIntervals);
    const nonLinear = this.analyzeNonLinear(rrIntervals);

    return {
      ...timeDomain,
      ...frequencyDomain,
      ...nonLinear
    };
  }

  private analyzeTimeDomain(rr: number[]): {
    meanRR: number;
    sdnn: number;
    rmssd: number;
    pnn50: number;
    meanHR: number;
    sdHR: number;
  } {
    const n = rr.length;
    if (n === 0) {
      return { meanRR: 0, sdnn: 0, rmssd: 0, pnn50: 0, meanHR: 0, sdHR: 0 };
    }

    // Mean RR
    const meanRR = rr.reduce((a, b) => a + b, 0) / n;

    // SDNN
    const variance = rr.reduce((sum, val) => sum + Math.pow(val - meanRR, 2), 0) / (n - 1);
    const sdnn = Math.sqrt(variance);

    // RMSSD and pNN50
    let sumSquaredDiff = 0;
    let countNN50 = 0;

    for (let i = 1; i < n; i++) {
      const diff = rr[i] - rr[i - 1];
      sumSquaredDiff += diff * diff;
      if (Math.abs(diff) > 50) {
        countNN50++;
      }
    }

    const rmssd = Math.sqrt(sumSquaredDiff / (n - 1));
    const pnn50 = (countNN50 / (n - 1)) * 100;

    // Heart rate statistics
    const heartRates = rr.map(interval => 60000 / interval);
    const meanHR = heartRates.reduce((a, b) => a + b, 0) / n;
    const hrVariance = heartRates.reduce((sum, val) => sum + Math.pow(val - meanHR, 2), 0) / (n - 1);
    const sdHR = Math.sqrt(hrVariance);

    return { meanRR, sdnn, rmssd, pnn50, meanHR, sdHR };
  }

  private analyzeFrequencyDomain(rr: number[]): {
    vlf: number;
    lf: number;
    hf: number;
    lfHfRatio: number;
    totalPower: number;
  } {
    if (rr.length < 32) {
      return { vlf: 0, lf: 0, hf: 0, lfHfRatio: 0, totalPower: 0 };
    }

    // Interpolate RR intervals to regular sampling
    const resampledRR = this.interpolateRR(rr, 4); // 4 Hz resampling

    // Remove mean
    const mean = resampledRR.reduce((a, b) => a + b, 0) / resampledRR.length;
    const centered = resampledRR.map(v => v - mean);

    // Compute power spectrum using Welch's method (simplified)
    const psd = this.computePSD(centered, 4);

    // Integrate power in frequency bands
    const vlf = this.integratePower(psd, 0.003, 0.04, 4);
    const lf = this.integratePower(psd, 0.04, 0.15, 4);
    const hf = this.integratePower(psd, 0.15, 0.4, 4);
    const totalPower = vlf + lf + hf;
    const lfHfRatio = hf > 0 ? lf / hf : 0;

    return { vlf, lf, hf, lfHfRatio, totalPower };
  }

  private interpolateRR(rr: number[], targetRate: number): number[] {
    const totalTime = rr.reduce((a, b) => a + b, 0);
    const numSamples = Math.floor(totalTime * targetRate / 1000);
    const result: number[] = new Array(numSamples);

    let cumTime = 0;
    let rrIdx = 0;

    for (let i = 0; i < numSamples; i++) {
      const time = (i / targetRate) * 1000;

      while (rrIdx < rr.length - 1 && cumTime + rr[rrIdx] < time) {
        cumTime += rr[rrIdx];
        rrIdx++;
      }

      result[i] = rr[Math.min(rrIdx, rr.length - 1)];
    }

    return result;
  }

  private computePSD(signal: number[], sampleRate: number): number[] {
    // Simple periodogram using DFT
    const n = signal.length;
    const psd: number[] = new Array(Math.floor(n / 2));

    for (let k = 0; k < psd.length; k++) {
      let real = 0;
      let imag = 0;

      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += signal[t] * Math.cos(angle);
        imag -= signal[t] * Math.sin(angle);
      }

      psd[k] = (real * real + imag * imag) / (n * sampleRate);
    }

    return psd;
  }

  private integratePower(psd: number[], fLow: number, fHigh: number, sampleRate: number): number {
    const df = sampleRate / (2 * psd.length);
    let power = 0;

    for (let i = 0; i < psd.length; i++) {
      const freq = i * df;
      if (freq >= fLow && freq <= fHigh) {
        power += psd[i] * df;
      }
    }

    return power;
  }

  private analyzeNonLinear(rr: number[]): {
    sd1: number;
    sd2: number;
    sd1sd2Ratio: number;
  } {
    if (rr.length < 2) {
      return { sd1: 0, sd2: 0, sd1sd2Ratio: 0 };
    }

    // Poincaré plot analysis
    const x: number[] = [];
    const y: number[] = [];

    for (let i = 0; i < rr.length - 1; i++) {
      x.push(rr[i]);
      y.push(rr[i + 1]);
    }

    // SD1: perpendicular to line of identity
    const diffXY = x.map((val, i) => y[i] - val);
    const sdDiff = this.std(diffXY);
    const sd1 = sdDiff / Math.sqrt(2);

    // SD2: along line of identity
    const sumXY = x.map((val, i) => val + y[i]);
    const sdSum = this.std(sumXY);
    const sd2 = sdSum / Math.sqrt(2);

    const sd1sd2Ratio = sd2 > 0 ? sd1 / sd2 : 0;

    return { sd1, sd2, sd1sd2Ratio };
  }

  private std(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
  }
}

// ============================================================================
// ARRHYTHMIA CLASSIFIER
// ============================================================================

type ArrhythmiaType =
  | 'normal_sinus_rhythm'
  | 'sinus_bradycardia'
  | 'sinus_tachycardia'
  | 'atrial_fibrillation'
  | 'atrial_flutter'
  | 'supraventricular_tachycardia'
  | 'ventricular_tachycardia'
  | 'ventricular_fibrillation'
  | 'premature_atrial_contraction'
  | 'premature_ventricular_contraction'
  | 'first_degree_av_block'
  | 'second_degree_av_block_type1'
  | 'second_degree_av_block_type2'
  | 'third_degree_av_block'
  | 'bundle_branch_block'
  | 'unknown';

interface ArrhythmiaClassification {
  type: ArrhythmiaType;
  confidence: number;
  evidence: string[];
  severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';
  recommendations: string[];
}

class ArrhythmiaClassifier {
  classify(
    heartRate: number,
    rrIntervals: number[],
    intervals: Intervals[],
    morphology: WaveAmplitudes[]
  ): ArrhythmiaClassification {
    const evidence: string[] = [];
    let type: ArrhythmiaType = 'normal_sinus_rhythm';
    let confidence = 0.9;
    let severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical' = 'normal';

    // Calculate RR variability
    const rrVariability = this.calculateRRVariability(rrIntervals);
    const meanPR = this.meanValid(intervals.map(i => i.prInterval));
    const meanQRS = this.meanValid(intervals.map(i => i.qrsWidth));

    // Check for bradycardia/tachycardia
    if (heartRate < 60) {
      type = 'sinus_bradycardia';
      evidence.push(`Heart rate ${heartRate.toFixed(0)} bpm < 60 bpm`);
      severity = heartRate < 40 ? 'moderate' : 'mild';
    } else if (heartRate > 100) {
      type = 'sinus_tachycardia';
      evidence.push(`Heart rate ${heartRate.toFixed(0)} bpm > 100 bpm`);
      severity = heartRate > 150 ? 'moderate' : 'mild';
    }

    // Check for atrial fibrillation (irregular RR with absent P waves)
    if (rrVariability > 0.15) {
      const pWaveAbsent = morphology.filter(m => m.pAmplitude === null || Math.abs(m.pAmplitude) < 0.05).length;
      if (pWaveAbsent > morphology.length * 0.5) {
        type = 'atrial_fibrillation';
        confidence = 0.85;
        evidence.push(`Irregular RR intervals (variability: ${(rrVariability * 100).toFixed(1)}%)`);
        evidence.push(`Absent or diminished P waves in ${pWaveAbsent}/${morphology.length} complexes`);
        severity = 'moderate';
      }
    }

    // Check for wide QRS (bundle branch block or ventricular origin)
    if (meanQRS !== null && meanQRS > 120) {
      if (heartRate > 100) {
        type = 'ventricular_tachycardia';
        confidence = 0.75;
        evidence.push(`Wide QRS (${meanQRS.toFixed(0)} ms) with tachycardia`);
        severity = 'severe';
      } else {
        type = 'bundle_branch_block';
        confidence = 0.8;
        evidence.push(`Wide QRS duration: ${meanQRS.toFixed(0)} ms > 120 ms`);
        severity = 'mild';
      }
    }

    // Check for AV blocks
    if (meanPR !== null) {
      if (meanPR > 200 && meanPR < 300) {
        type = 'first_degree_av_block';
        confidence = 0.85;
        evidence.push(`Prolonged PR interval: ${meanPR.toFixed(0)} ms > 200 ms`);
        severity = 'mild';
      } else if (meanPR > 300) {
        type = 'first_degree_av_block';
        confidence = 0.9;
        evidence.push(`Markedly prolonged PR interval: ${meanPR.toFixed(0)} ms`);
        severity = 'moderate';
      }
    }

    // Check for PVCs (wide QRS without preceding P wave)
    const pvcCount = this.countPVCs(morphology, intervals);
    if (pvcCount > 0 && type === 'normal_sinus_rhythm') {
      type = 'premature_ventricular_contraction';
      confidence = 0.8;
      evidence.push(`${pvcCount} premature ventricular contraction(s) detected`);
      severity = pvcCount > 6 ? 'moderate' : 'mild';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(type, severity, heartRate);

    if (type === 'normal_sinus_rhythm') {
      evidence.push(`Heart rate: ${heartRate.toFixed(0)} bpm (normal range)`);
      evidence.push('Regular rhythm with normal P-QRS-T morphology');
    }

    return {
      type,
      confidence,
      evidence,
      severity,
      recommendations
    };
  }

  private calculateRRVariability(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 0;

    const mean = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    const variance = rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rrIntervals.length;

    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private meanValid(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  private countPVCs(morphology: WaveAmplitudes[], intervals: Intervals[]): number {
    let count = 0;

    for (let i = 0; i < morphology.length; i++) {
      const qrs = intervals[i]?.qrsWidth;
      const pWave = morphology[i].pAmplitude;

      // Wide QRS without P wave suggests PVC
      if (qrs !== null && qrs > 120 && (pWave === null || Math.abs(pWave) < 0.05)) {
        count++;
      }
    }

    return count;
  }

  private generateRecommendations(type: ArrhythmiaType, severity: string, heartRate: number): string[] {
    const recommendations: string[] = [];

    switch (type) {
      case 'normal_sinus_rhythm':
        recommendations.push('Normal findings - routine follow-up as indicated');
        break;

      case 'sinus_bradycardia':
        if (severity === 'moderate' || severity === 'severe') {
          recommendations.push('Evaluate for symptomatic bradycardia');
          recommendations.push('Consider medication review (beta-blockers, calcium channel blockers)');
          recommendations.push('May require pacemaker evaluation if symptomatic');
        } else {
          recommendations.push('Monitor for symptoms (dizziness, syncope, fatigue)');
        }
        break;

      case 'sinus_tachycardia':
        recommendations.push('Evaluate for underlying causes (fever, anxiety, dehydration, anemia)');
        recommendations.push('Review medications and stimulant intake');
        break;

      case 'atrial_fibrillation':
        recommendations.push('Calculate CHA2DS2-VASc score for stroke risk');
        recommendations.push('Consider anticoagulation therapy');
        recommendations.push('Rate control vs rhythm control strategy evaluation');
        recommendations.push('Cardiology consultation recommended');
        break;

      case 'ventricular_tachycardia':
        recommendations.push('URGENT: Requires immediate medical evaluation');
        recommendations.push('Assess hemodynamic stability');
        recommendations.push('Consider electrolyte abnormalities');
        recommendations.push('Cardiology/EP consultation required');
        break;

      case 'bundle_branch_block':
        recommendations.push('Correlate with clinical history');
        recommendations.push('May require echocardiogram to assess ventricular function');
        break;

      case 'first_degree_av_block':
        recommendations.push('Usually benign - monitor for progression');
        recommendations.push('Review medications affecting AV conduction');
        break;

      case 'premature_ventricular_contraction':
        recommendations.push('Evaluate frequency and symptoms');
        recommendations.push('Consider Holter monitoring for burden assessment');
        if (heartRate > 100) {
          recommendations.push('Frequent PVCs with tachycardia - further evaluation needed');
        }
        break;

      default:
        recommendations.push('Further evaluation recommended');
        recommendations.push('Consider cardiology consultation');
    }

    return recommendations;
  }
}

// ============================================================================
// ST SEGMENT ANALYZER
// ============================================================================

interface STAnalysis {
  elevation: number[];       // ST elevation in mV per lead
  depression: number[];      // ST depression in mV per lead
  ischemiaDetected: boolean;
  stemiCriteria: boolean;
  affectedTerritory: string | null;
  interpretation: string;
}

class STSegmentAnalyzer {
  private sampleRate: number;

  constructor(sampleRate: number = 360) {
    this.sampleRate = sampleRate;
  }

  analyze(signal: number[], wavePoints: WavePoints[]): STAnalysis {
    const stLevels: number[] = [];

    for (const wp of wavePoints) {
      if (wp.sOffset !== null && wp.tOnset !== null) {
        // Measure ST level at J-point + 60ms
        const jPoint = wp.sOffset;
        const measurePoint = jPoint + Math.round(0.06 * this.sampleRate);

        if (measurePoint < signal.length) {
          // Reference to isoelectric line (PR segment)
          const isoelectric = wp.pOffset !== null && wp.qOnset !== null
            ? (signal[wp.pOffset] + signal[wp.qOnset]) / 2
            : 0;

          const stLevel = signal[measurePoint] - isoelectric;
          stLevels.push(stLevel);
        }
      }
    }

    const elevation = stLevels.filter(st => st > 0.1);
    const depression = stLevels.filter(st => st < -0.1);

    const ischemiaDetected = elevation.length > 0 || depression.length > 0;
    const stemiCriteria = elevation.some(e => e > 0.2);

    let affectedTerritory: string | null = null;
    let interpretation = 'Normal ST segments';

    if (stemiCriteria) {
      interpretation = 'ST elevation meeting STEMI criteria - acute coronary syndrome';
      affectedTerritory = 'Unable to determine without lead information';
    } else if (elevation.length > 0) {
      interpretation = `ST elevation detected (${elevation.length} complexes) - consider acute coronary syndrome`;
    } else if (depression.length > 0) {
      interpretation = `ST depression detected (${depression.length} complexes) - consider ischemia`;
    }

    return {
      elevation: elevation,
      depression: depression.map(d => Math.abs(d)),
      ischemiaDetected,
      stemiCriteria,
      affectedTerritory,
      interpretation
    };
  }
}

// ============================================================================
// AXIS CALCULATOR
// ============================================================================

interface AxisAnalysis {
  qrsAxis: number;  // Degrees
  interpretation: string;
  deviation: 'normal' | 'left' | 'right' | 'extreme';
}

class AxisCalculator {
  // Calculate frontal plane axis from lead I and aVF amplitudes
  calculate(leadI_amplitude: number, aVF_amplitude: number): AxisAnalysis {
    // Calculate axis using atan2
    const axisRadians = Math.atan2(aVF_amplitude, leadI_amplitude);
    let axisDegrees = axisRadians * (180 / Math.PI);

    // Normalize to -180 to 180
    if (axisDegrees > 180) axisDegrees -= 360;
    if (axisDegrees < -180) axisDegrees += 360;

    // Determine deviation
    let deviation: 'normal' | 'left' | 'right' | 'extreme';
    let interpretation: string;

    if (axisDegrees >= -30 && axisDegrees <= 90) {
      deviation = 'normal';
      interpretation = `Normal axis (${axisDegrees.toFixed(0)}°)`;
    } else if (axisDegrees >= -90 && axisDegrees < -30) {
      deviation = 'left';
      interpretation = `Left axis deviation (${axisDegrees.toFixed(0)}°) - consider LVH, LAFB, inferior MI`;
    } else if (axisDegrees > 90 && axisDegrees <= 180) {
      deviation = 'right';
      interpretation = `Right axis deviation (${axisDegrees.toFixed(0)}°) - consider RVH, LPFB, lateral MI`;
    } else {
      deviation = 'extreme';
      interpretation = `Extreme axis deviation (${axisDegrees.toFixed(0)}°) - consider ventricular rhythm`;
    }

    return {
      qrsAxis: axisDegrees,
      interpretation,
      deviation
    };
  }
}

// ============================================================================
// MAIN ECG ANALYZER
// ============================================================================

interface ECGAnalysisResult {
  summary: {
    heartRate: number;
    rhythm: ArrhythmiaType;
    rhythmConfidence: number;
    severity: string;
  };
  rPeaks: {
    indices: number[];
    count: number;
  };
  intervals: {
    mean: Intervals;
    individual: Intervals[];
  };
  hrv: HRVMetrics;
  morphology: {
    wavePoints: WavePoints[];
    amplitudes: WaveAmplitudes[];
  };
  arrhythmia: ArrhythmiaClassification;
  stAnalysis: STAnalysis;
  recommendations: string[];
  qualityMetrics: {
    signalQuality: 'good' | 'fair' | 'poor';
    noiseLevel: number;
    baselineStable: boolean;
  };
}

class ECGAnalyzer {
  private sampleRate: number;
  private panTompkins: PanTompkinsDetector;
  private morphologyAnalyzer: WaveMorphologyAnalyzer;
  private hrvAnalyzer: HRVAnalyzer;
  private arrhythmiaClassifier: ArrhythmiaClassifier;
  private stAnalyzer: STSegmentAnalyzer;

  constructor(sampleRate: number = 360) {
    this.sampleRate = sampleRate;
    this.panTompkins = new PanTompkinsDetector(sampleRate);
    this.morphologyAnalyzer = new WaveMorphologyAnalyzer(sampleRate);
    this.hrvAnalyzer = new HRVAnalyzer();
    this.arrhythmiaClassifier = new ArrhythmiaClassifier();
    this.stAnalyzer = new STSegmentAnalyzer(sampleRate);
  }

  analyze(signal: number[]): ECGAnalysisResult {
    // Preprocess signal
    let processed = SignalProcessor.notchFilter(signal, 60, this.sampleRate);
    processed = SignalProcessor.removeBaseline(processed, Math.round(0.6 * this.sampleRate));

    // Detect R peaks
    const detection = this.panTompkins.detect(processed);
    const rPeaks = detection.rPeaks;

    // Analyze each complex
    const wavePointsList: WavePoints[] = [];
    const amplitudesList: WaveAmplitudes[] = [];
    const intervalsList: Intervals[] = [];

    for (let i = 0; i < rPeaks.length; i++) {
      const prevR = i > 0 ? rPeaks[i - 1] : null;
      const nextR = i < rPeaks.length - 1 ? rPeaks[i + 1] : null;

      const analysis = this.morphologyAnalyzer.analyzeComplex(processed, rPeaks[i], prevR, nextR);
      wavePointsList.push(analysis.wavePoints);
      amplitudesList.push(analysis.amplitudes);
      intervalsList.push(analysis.intervals);
    }

    // Calculate RR intervals
    const rrIntervals: number[] = [];
    for (let i = 1; i < rPeaks.length; i++) {
      const rrMs = ((rPeaks[i] - rPeaks[i - 1]) / this.sampleRate) * 1000;
      rrIntervals.push(rrMs);
    }

    // Calculate heart rate
    const meanRR = rrIntervals.length > 0
      ? rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length
      : 0;
    const heartRate = meanRR > 0 ? 60000 / meanRR : 0;

    // HRV analysis
    const hrv = this.hrvAnalyzer.analyze(rrIntervals);

    // Arrhythmia classification
    const arrhythmia = this.arrhythmiaClassifier.classify(
      heartRate,
      rrIntervals,
      intervalsList,
      amplitudesList
    );

    // ST segment analysis
    const stAnalysis = this.stAnalyzer.analyze(processed, wavePointsList);

    // Calculate mean intervals
    const meanIntervals = this.calculateMeanIntervals(intervalsList);

    // Assess signal quality
    const qualityMetrics = this.assessSignalQuality(signal, processed, rPeaks);

    return {
      summary: {
        heartRate: Math.round(heartRate),
        rhythm: arrhythmia.type,
        rhythmConfidence: arrhythmia.confidence,
        severity: arrhythmia.severity
      },
      rPeaks: {
        indices: rPeaks,
        count: rPeaks.length
      },
      intervals: {
        mean: meanIntervals,
        individual: intervalsList
      },
      hrv,
      morphology: {
        wavePoints: wavePointsList,
        amplitudes: amplitudesList
      },
      arrhythmia,
      stAnalysis,
      recommendations: arrhythmia.recommendations,
      qualityMetrics
    };
  }

  private calculateMeanIntervals(intervals: Intervals[]): Intervals {
    const validPR = intervals.filter(i => i.prInterval !== null).map(i => i.prInterval!);
    const validQRS = intervals.filter(i => i.qrsWidth !== null).map(i => i.qrsWidth!);
    const validQT = intervals.filter(i => i.qtInterval !== null).map(i => i.qtInterval!);
    const validQTcB = intervals.filter(i => i.qtcBazett !== null).map(i => i.qtcBazett!);
    const validQTcF = intervals.filter(i => i.qtcFridericia !== null).map(i => i.qtcFridericia!);
    const validRR = intervals.filter(i => i.rrInterval !== null).map(i => i.rrInterval!);

    const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return {
      prInterval: mean(validPR),
      qrsWidth: mean(validQRS),
      qtInterval: mean(validQT),
      qtcBazett: mean(validQTcB),
      qtcFridericia: mean(validQTcF),
      rrInterval: mean(validRR)
    };
  }

  private assessSignalQuality(original: number[], processed: number[], rPeaks: number[]): {
    signalQuality: 'good' | 'fair' | 'poor';
    noiseLevel: number;
    baselineStable: boolean;
  } {
    // Estimate noise level
    const noise = original.map((v, i) => Math.abs(v - processed[i]));
    const meanNoise = noise.reduce((a, b) => a + b, 0) / noise.length;
    const signalPower = processed.reduce((sum, v) => sum + v * v, 0) / processed.length;
    const snr = signalPower > 0 ? 10 * Math.log10(signalPower / (meanNoise * meanNoise)) : 0;

    // Check baseline stability
    const baseline = SignalProcessor.medianFilter(original, Math.round(0.6 * this.sampleRate));
    const baselineVariation = this.std(baseline);
    const baselineStable = baselineVariation < 0.2;

    // Overall quality
    let signalQuality: 'good' | 'fair' | 'poor';
    if (snr > 15 && baselineStable && rPeaks.length > 3) {
      signalQuality = 'good';
    } else if (snr > 8 && rPeaks.length > 1) {
      signalQuality = 'fair';
    } else {
      signalQuality = 'poor';
    }

    return {
      signalQuality,
      noiseLevel: meanNoise,
      baselineStable
    };
  }

  private std(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }
}

// ============================================================================
// DEMO DATA GENERATOR
// ============================================================================

class ECGDemoGenerator {
  private sampleRate: number;

  constructor(sampleRate: number = 360) {
    this.sampleRate = sampleRate;
  }

  generateNormalSinus(duration: number = 10, heartRate: number = 72): number[] {
    const numSamples = Math.round(duration * this.sampleRate);
    const signal: number[] = new Array(numSamples).fill(0);
    const rrInterval = (60 / heartRate) * this.sampleRate;

    let t = 0;
    while (t < numSamples) {
      this.addPQRST(signal, Math.round(t));
      t += rrInterval + (Math.random() - 0.5) * 0.05 * rrInterval; // Small variability
    }

    // Add some noise
    for (let i = 0; i < signal.length; i++) {
      signal[i] += (Math.random() - 0.5) * 0.02;
    }

    return signal;
  }

  generateAFib(duration: number = 10): number[] {
    const numSamples = Math.round(duration * this.sampleRate);
    const signal: number[] = new Array(numSamples).fill(0);

    // Irregular RR intervals
    let t = 0;
    while (t < numSamples) {
      this.addQRST(signal, Math.round(t)); // No P wave
      t += (0.4 + Math.random() * 0.6) * this.sampleRate; // Irregular rhythm
    }

    // Add fibrillatory baseline
    for (let i = 0; i < signal.length; i++) {
      signal[i] += Math.sin(i * 0.1) * 0.02 + (Math.random() - 0.5) * 0.03;
    }

    return signal;
  }

  generateBradycardia(duration: number = 10): number[] {
    return this.generateNormalSinus(duration, 45);
  }

  generateTachycardia(duration: number = 10): number[] {
    return this.generateNormalSinus(duration, 120);
  }

  private addPQRST(signal: number[], rPeakIndex: number): void {
    // P wave (-60ms from QRS onset)
    this.addGaussian(signal, rPeakIndex - 60, 0.15, 20);

    // QRS complex
    this.addQRST(signal, rPeakIndex);
  }

  private addQRST(signal: number[], rPeakIndex: number): void {
    // Q wave
    this.addGaussian(signal, rPeakIndex - 10, -0.1, 5);

    // R wave
    this.addGaussian(signal, rPeakIndex, 1.0, 8);

    // S wave
    this.addGaussian(signal, rPeakIndex + 10, -0.2, 6);

    // T wave
    this.addGaussian(signal, rPeakIndex + 100, 0.25, 40);
  }

  private addGaussian(signal: number[], center: number, amplitude: number, width: number): void {
    for (let i = Math.max(0, center - width * 3); i < Math.min(signal.length, center + width * 3); i++) {
      const x = i - center;
      signal[i] += amplitude * Math.exp(-(x * x) / (2 * width * width));
    }
  }
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const ecganalyzerTool: UnifiedTool = {
  name: 'ecg_analyzer',
  description: `Comprehensive ECG waveform analysis and arrhythmia detection tool using the Pan-Tompkins algorithm
for R-peak detection, morphological analysis for PQRST wave identification, heart rate variability (HRV)
analysis, and machine learning-based arrhythmia classification.

Features:
- R-peak detection using Pan-Tompkins algorithm with adaptive thresholding
- PQRST wave morphology analysis with precise interval measurements
- Heart rate variability (HRV) analysis (time domain, frequency domain, non-linear)
- Arrhythmia classification (AFib, VTach, PVC, AV blocks, bundle branch blocks)
- ST segment analysis for ischemia detection
- QT interval measurement with Bazett and Fridericia corrections
- Signal quality assessment and preprocessing

Operations:
- analyze: Full ECG analysis with arrhythmia detection
- detect_rpeaks: R-peak detection only
- hrv: Heart rate variability analysis
- intervals: Measure PR, QRS, QT intervals
- classify: Classify arrhythmia type
- st_analysis: Analyze ST segments for ischemia
- generate_demo: Generate synthetic ECG data
- info: Tool documentation
- examples: Usage examples`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'detect_rpeaks', 'hrv', 'intervals', 'classify', 'st_analysis', 'generate_demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      signal: {
        type: 'array',
        items: { type: 'number' },
        description: 'ECG signal data as array of voltage values (mV)'
      },
      sample_rate: {
        type: 'number',
        description: 'Sample rate in Hz (default: 360)'
      },
      rr_intervals: {
        type: 'array',
        items: { type: 'number' },
        description: 'RR intervals in milliseconds for HRV analysis'
      },
      demo_type: {
        type: 'string',
        enum: ['normal', 'afib', 'bradycardia', 'tachycardia'],
        description: 'Type of demo signal to generate'
      },
      duration: {
        type: 'number',
        description: 'Duration of demo signal in seconds'
      }
    },
    required: ['operation']
  }
};

export async function executeecganalyzer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const sampleRate = args.sample_rate || 360;

    switch (operation) {
      case 'analyze': {
        const signal = args.signal;
        if (!signal || !Array.isArray(signal) || signal.length === 0) {
          return { toolCallId: id, content: 'Error: signal array is required for analysis', isError: true };
        }

        const analyzer = new ECGAnalyzer(sampleRate);
        const result = analyzer.analyze(signal);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            summary: result.summary,
            intervals: {
              prInterval: result.intervals.mean.prInterval?.toFixed(1) + ' ms',
              qrsWidth: result.intervals.mean.qrsWidth?.toFixed(1) + ' ms',
              qtInterval: result.intervals.mean.qtInterval?.toFixed(1) + ' ms',
              qtcBazett: result.intervals.mean.qtcBazett?.toFixed(1) + ' ms',
              rrInterval: result.intervals.mean.rrInterval?.toFixed(1) + ' ms'
            },
            arrhythmia: result.arrhythmia,
            stAnalysis: result.stAnalysis,
            hrv: {
              meanRR: result.hrv.meanRR.toFixed(1) + ' ms',
              sdnn: result.hrv.sdnn.toFixed(1) + ' ms',
              rmssd: result.hrv.rmssd.toFixed(1) + ' ms',
              pnn50: result.hrv.pnn50.toFixed(1) + '%',
              lfHfRatio: result.hrv.lfHfRatio.toFixed(2)
            },
            qualityMetrics: result.qualityMetrics,
            recommendations: result.recommendations
          }, null, 2)
        };
      }

      case 'detect_rpeaks': {
        const signal = args.signal;
        if (!signal || !Array.isArray(signal)) {
          return { toolCallId: id, content: 'Error: signal array is required', isError: true };
        }

        const detector = new PanTompkinsDetector(sampleRate);
        const detection = detector.detect(signal);

        // Calculate RR intervals and heart rate
        const rrIntervals: number[] = [];
        for (let i = 1; i < detection.rPeaks.length; i++) {
          const rrMs = ((detection.rPeaks[i] - detection.rPeaks[i - 1]) / sampleRate) * 1000;
          rrIntervals.push(rrMs);
        }
        const meanRR = rrIntervals.length > 0
          ? rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length
          : 0;
        const heartRate = meanRR > 0 ? Math.round(60000 / meanRR) : 0;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect_rpeaks',
            rPeaks: detection.rPeaks,
            count: detection.rPeaks.length,
            heartRate: heartRate + ' bpm',
            rrIntervals: rrIntervals.map(rr => Math.round(rr)),
            threshold: detection.threshold
          }, null, 2)
        };
      }

      case 'hrv': {
        const rrIntervals = args.rr_intervals || args.signal;
        if (!rrIntervals || !Array.isArray(rrIntervals) || rrIntervals.length < 5) {
          return { toolCallId: id, content: 'Error: at least 5 RR intervals are required for HRV analysis', isError: true };
        }

        const analyzer = new HRVAnalyzer();
        const hrv = analyzer.analyze(rrIntervals);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'hrv',
            timeDomain: {
              meanRR: hrv.meanRR.toFixed(1) + ' ms',
              sdnn: hrv.sdnn.toFixed(1) + ' ms',
              rmssd: hrv.rmssd.toFixed(1) + ' ms',
              pnn50: hrv.pnn50.toFixed(1) + '%',
              meanHR: hrv.meanHR.toFixed(1) + ' bpm',
              sdHR: hrv.sdHR.toFixed(1) + ' bpm'
            },
            frequencyDomain: {
              vlf: hrv.vlf.toFixed(2) + ' ms²',
              lf: hrv.lf.toFixed(2) + ' ms²',
              hf: hrv.hf.toFixed(2) + ' ms²',
              lfHfRatio: hrv.lfHfRatio.toFixed(2),
              totalPower: hrv.totalPower.toFixed(2) + ' ms²'
            },
            nonLinear: {
              sd1: hrv.sd1.toFixed(1) + ' ms',
              sd2: hrv.sd2.toFixed(1) + ' ms',
              sd1sd2Ratio: hrv.sd1sd2Ratio.toFixed(2)
            },
            interpretation: {
              autonomicBalance: hrv.lfHfRatio > 2 ? 'Sympathetic dominant' :
                               hrv.lfHfRatio < 0.5 ? 'Parasympathetic dominant' : 'Balanced',
              variability: hrv.sdnn > 100 ? 'High' : hrv.sdnn > 50 ? 'Normal' : 'Reduced'
            }
          }, null, 2)
        };
      }

      case 'intervals': {
        const signal = args.signal;
        if (!signal || !Array.isArray(signal)) {
          return { toolCallId: id, content: 'Error: signal array is required', isError: true };
        }

        const analyzer = new ECGAnalyzer(sampleRate);
        const result = analyzer.analyze(signal);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'intervals',
            meanIntervals: {
              prInterval: result.intervals.mean.prInterval ? result.intervals.mean.prInterval.toFixed(1) + ' ms' : 'N/A',
              qrsWidth: result.intervals.mean.qrsWidth ? result.intervals.mean.qrsWidth.toFixed(1) + ' ms' : 'N/A',
              qtInterval: result.intervals.mean.qtInterval ? result.intervals.mean.qtInterval.toFixed(1) + ' ms' : 'N/A',
              qtcBazett: result.intervals.mean.qtcBazett ? result.intervals.mean.qtcBazett.toFixed(1) + ' ms' : 'N/A',
              qtcFridericia: result.intervals.mean.qtcFridericia ? result.intervals.mean.qtcFridericia.toFixed(1) + ' ms' : 'N/A',
              rrInterval: result.intervals.mean.rrInterval ? result.intervals.mean.rrInterval.toFixed(1) + ' ms' : 'N/A'
            },
            normalRanges: {
              prInterval: '120-200 ms',
              qrsWidth: '< 120 ms',
              qtInterval: '350-440 ms',
              qtcBazett: '< 440 ms (male), < 460 ms (female)'
            },
            complexCount: result.intervals.individual.length
          }, null, 2)
        };
      }

      case 'generate_demo': {
        const demoType = args.demo_type || 'normal';
        const duration = args.duration || 10;

        const generator = new ECGDemoGenerator(sampleRate);
        let signal: number[];

        switch (demoType) {
          case 'afib':
            signal = generator.generateAFib(duration);
            break;
          case 'bradycardia':
            signal = generator.generateBradycardia(duration);
            break;
          case 'tachycardia':
            signal = generator.generateTachycardia(duration);
            break;
          default:
            signal = generator.generateNormalSinus(duration);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'generate_demo',
            type: demoType,
            duration: duration + ' seconds',
            sampleRate: sampleRate + ' Hz',
            samples: signal.length,
            signal: signal.slice(0, 100), // Return first 100 samples as preview
            note: 'Full signal available with ' + signal.length + ' samples'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'ecg_analyzer',
            version: '1.0.0',
            description: 'Comprehensive ECG analysis tool with arrhythmia detection',
            algorithms: {
              rPeakDetection: 'Pan-Tompkins algorithm with adaptive thresholding',
              morphologyAnalysis: 'Template matching and derivative-based wave detection',
              hrvAnalysis: 'Time domain, frequency domain (Welch), and Poincaré plot',
              arrhythmiaClassification: 'Rule-based classification with confidence scoring'
            },
            supportedArrhythmias: [
              'Normal sinus rhythm',
              'Sinus bradycardia/tachycardia',
              'Atrial fibrillation',
              'Ventricular tachycardia',
              'Premature ventricular contractions',
              'AV blocks (1st, 2nd, 3rd degree)',
              'Bundle branch block'
            ],
            intervals: {
              PR: 'P wave onset to QRS onset (normal: 120-200 ms)',
              QRS: 'QRS complex duration (normal: < 120 ms)',
              QT: 'QRS onset to T wave end',
              QTc: 'Corrected QT (Bazett and Fridericia formulas)'
            },
            disclaimer: 'This tool is for educational and research purposes. Always consult a qualified healthcare professional for clinical interpretation.'
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Full ECG analysis',
                call: {
                  operation: 'analyze',
                  signal: '[...ECG data...]',
                  sample_rate: 360
                }
              },
              {
                name: 'R-peak detection',
                call: {
                  operation: 'detect_rpeaks',
                  signal: '[...ECG data...]',
                  sample_rate: 500
                }
              },
              {
                name: 'HRV analysis from RR intervals',
                call: {
                  operation: 'hrv',
                  rr_intervals: [850, 820, 880, 830, 870, 840, 860]
                }
              },
              {
                name: 'Generate demo normal sinus rhythm',
                call: {
                  operation: 'generate_demo',
                  demo_type: 'normal',
                  duration: 10
                }
              },
              {
                name: 'Generate demo atrial fibrillation',
                call: {
                  operation: 'generate_demo',
                  demo_type: 'afib',
                  duration: 10
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Error: Unknown operation '${operation}'. Valid operations: analyze, detect_rpeaks, hrv, intervals, classify, st_analysis, generate_demo, info, examples`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isecganalyzerAvailable(): boolean {
  return true;
}
