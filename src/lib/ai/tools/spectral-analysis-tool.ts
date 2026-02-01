/**
 * SPECTRAL ANALYSIS TOOL
 * Spectrum analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function wavelengthToFreq(lambda: number): number { return 3e8 / lambda; }
function energyFromWavelength(lambda: number): number { return 6.626e-34 * 3e8 / lambda / 1.6e-19; }
function snr(signal: number, noise: number): number { return 10 * Math.log10(signal / noise); }
function resolution(lambda: number, dlambda: number): number { return lambda / dlambda; }
function peakWidth(fwhm: number, f0: number): number { return f0 / fwhm; }
function doppler(f0: number, v: number): number { return f0 * (1 + v / 3e8); }
function absorbance(i0: number, i: number): number { return Math.log10(i0 / i); }

export const spectralAnalysisTool: UnifiedTool = {
  name: 'spectral_analysis',
  description: 'Spectral: wavelength_freq, energy, snr, resolution, q_factor, doppler, absorbance',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['wavelength_freq', 'energy', 'snr', 'resolution', 'q_factor', 'doppler', 'absorbance'] }, lambda: { type: 'number' }, signal: { type: 'number' }, noise: { type: 'number' }, dlambda: { type: 'number' }, fwhm: { type: 'number' }, f0: { type: 'number' }, v: { type: 'number' }, i0: { type: 'number' }, i: { type: 'number' } }, required: ['operation'] },
};

export async function executeSpectralAnalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'wavelength_freq': result = { Hz: wavelengthToFreq(args.lambda || 500e-9) }; break;
      case 'energy': result = { eV: energyFromWavelength(args.lambda || 500e-9) }; break;
      case 'snr': result = { dB: snr(args.signal || 100, args.noise || 1) }; break;
      case 'resolution': result = { R: resolution(args.lambda || 500, args.dlambda || 0.1) }; break;
      case 'q_factor': result = { Q: peakWidth(args.fwhm || 1e6, args.f0 || 1e9) }; break;
      case 'doppler': result = { Hz: doppler(args.f0 || 1e9, args.v || 1000) }; break;
      case 'absorbance': result = { A: absorbance(args.i0 || 100, args.i || 10) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSpectralAnalysisAvailable(): boolean { return true; }
