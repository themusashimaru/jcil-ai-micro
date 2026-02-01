/**
 * HEAT TRANSFER TOOL
 *
 * Thermal engineering: conduction, convection, radiation,
 * heat exchangers, and thermal resistance networks.
 *
 * Part of TIER ENGINEERING - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONDUCTION
// ============================================================================

function fourierLaw(k: number, A: number, dT: number, dx: number): number {
  // Q = -k × A × (dT/dx)
  return k * A * dT / dx;
}

function thermalResistanceConduction(L: number, k: number, A: number): number {
  // R = L / (k × A)
  return L / (k * A);
}

function _conductionCylinder(k: number, L: number, r1: number, r2: number, T1: number, T2: number): number {
  // Q = 2πkL(T1-T2) / ln(r2/r1)
  return (2 * Math.PI * k * L * (T1 - T2)) / Math.log(r2 / r1);
}

function _conductionSphere(k: number, r1: number, r2: number, T1: number, T2: number): number {
  // Q = 4πk(T1-T2) / (1/r1 - 1/r2)
  return (4 * Math.PI * k * (T1 - T2)) / (1 / r1 - 1 / r2);
}

// ============================================================================
// CONVECTION
// ============================================================================

function newtonCooling(h: number, A: number, Ts: number, Tinf: number): number {
  // Q = h × A × (Ts - Tinf)
  return h * A * (Ts - Tinf);
}

function thermalResistanceConvection(h: number, A: number): number {
  // R = 1 / (h × A)
  return 1 / (h * A);
}

function _nusseltNumber(h: number, L: number, k: number): number {
  // Nu = h × L / k
  return h * L / k;
}

// Natural convection correlations
function _naturalConvectionVertical(Ra: number): number {
  // Nu for vertical plate
  if (Ra < 1e9) {
    return 0.59 * Math.pow(Ra, 0.25);
  }
  return 0.1 * Math.pow(Ra, 1/3);
}

// Forced convection
function dittusBoelter(Re: number, Pr: number, heating: boolean = true): number {
  // Nu = 0.023 × Re^0.8 × Pr^n (n=0.4 heating, 0.3 cooling)
  const n = heating ? 0.4 : 0.3;
  return 0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, n);
}

// ============================================================================
// RADIATION
// ============================================================================

const STEFAN_BOLTZMANN = 5.67e-8; // W/(m²·K⁴)

function blackbodyEmission(T: number): number {
  // E = σ × T⁴
  return STEFAN_BOLTZMANN * Math.pow(T, 4);
}

function grayBodyRadiation(epsilon: number, A: number, T: number): number {
  // Q = ε × σ × A × T⁴
  return epsilon * STEFAN_BOLTZMANN * A * Math.pow(T, 4);
}

function radiationExchange(epsilon1: number, epsilon2: number, A: number, T1: number, T2: number): number {
  // Simplified for parallel plates
  const effectiveEpsilon = 1 / (1 / epsilon1 + 1 / epsilon2 - 1);
  return effectiveEpsilon * STEFAN_BOLTZMANN * A * (Math.pow(T1, 4) - Math.pow(T2, 4));
}

function wiensLaw(T: number): number {
  // λmax × T = 2898 μm·K
  return 2898 / T; // μm
}

// ============================================================================
// HEAT EXCHANGERS
// ============================================================================

function lmtd(Thi: number, Tho: number, Tci: number, Tco: number): number {
  // Log Mean Temperature Difference
  const dT1 = Thi - Tco;
  const dT2 = Tho - Tci;

  if (Math.abs(dT1 - dT2) < 0.01) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}

function heatExchangerDuty(U: number, A: number, LMTD: number, F: number = 1): number {
  // Q = U × A × F × LMTD
  return U * A * F * LMTD;
}

function ntu(U: number, A: number, Cmin: number): number {
  // NTU = U × A / Cmin
  return U * A / Cmin;
}

function effectiveness_counterflow(NTU: number, Cr: number): number {
  // ε for counterflow heat exchanger
  if (Math.abs(Cr - 1) < 0.01) {
    return NTU / (1 + NTU);
  }
  return (1 - Math.exp(-NTU * (1 - Cr))) / (1 - Cr * Math.exp(-NTU * (1 - Cr)));
}

// ============================================================================
// FINS
// ============================================================================

function finEfficiency(m: number, L: number): number {
  // η = tanh(mL) / (mL) for adiabatic tip
  const mL = m * L;
  return Math.tanh(mL) / mL;
}

function finParameter(h: number, P: number, k: number, Ac: number): number {
  // m = √(hP / kAc)
  return Math.sqrt(h * P / (k * Ac));
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const heatTransferTool: UnifiedTool = {
  name: 'heat_transfer',
  description: `Heat transfer and thermal engineering calculations.

Operations:
- conduction: Fourier's law and thermal resistance
- convection: Newton's cooling and heat transfer coefficients
- radiation: Stefan-Boltzmann and radiative exchange
- exchanger: Heat exchanger design (LMTD, NTU)
- fin: Extended surface calculations`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['conduction', 'convection', 'radiation', 'exchanger', 'fin'],
        description: 'Heat transfer operation',
      },
      k: { type: 'number', description: 'Thermal conductivity (W/m·K)' },
      h: { type: 'number', description: 'Heat transfer coefficient (W/m²·K)' },
      A: { type: 'number', description: 'Area (m²)' },
      L: { type: 'number', description: 'Length/thickness (m)' },
      T1: { type: 'number', description: 'Temperature 1 (K)' },
      T2: { type: 'number', description: 'Temperature 2 (K)' },
      Tinf: { type: 'number', description: 'Ambient temperature (K)' },
      epsilon: { type: 'number', description: 'Emissivity (0-1)' },
      Thi: { type: 'number', description: 'Hot inlet temperature (K)' },
      Tho: { type: 'number', description: 'Hot outlet temperature (K)' },
      Tci: { type: 'number', description: 'Cold inlet temperature (K)' },
      Tco: { type: 'number', description: 'Cold outlet temperature (K)' },
      U: { type: 'number', description: 'Overall heat transfer coefficient (W/m²·K)' },
      Re: { type: 'number', description: 'Reynolds number' },
      Pr: { type: 'number', description: 'Prandtl number' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeHeatTransfer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'conduction': {
        const { k = 50, A = 1, L = 0.1, T1 = 373, T2 = 293 } = args;
        const dT = T1 - T2;
        const Q = fourierLaw(k, A, dT, L);
        const R = thermalResistanceConduction(L, k, A);

        result = {
          operation: 'conduction',
          parameters: {
            thermal_conductivity_W_mK: k,
            area_m2: A,
            thickness_m: L,
            T1_K: T1,
            T2_K: T2,
          },
          heat_rate_W: Math.round(Q * 100) / 100,
          thermal_resistance_K_W: R.toExponential(4),
          temperature_gradient_K_m: Math.round(dT / L * 100) / 100,
          heat_flux_W_m2: Math.round(Q / A * 100) / 100,
        };
        break;
      }

      case 'convection': {
        const { h = 25, A = 1, T1 = 373, Tinf = 293, Re, Pr, k = 0.026, L = 0.1 } = args;
        const Ts = T1;
        const Q = newtonCooling(h, A, Ts, Tinf);
        const R = thermalResistanceConvection(h, A);

        const convResult: Record<string, unknown> = {
          operation: 'convection',
          parameters: {
            heat_transfer_coeff_W_m2K: h,
            area_m2: A,
            surface_temp_K: Ts,
            ambient_temp_K: Tinf,
          },
          heat_rate_W: Math.round(Q * 100) / 100,
          thermal_resistance_K_W: Math.round(R * 10000) / 10000,
        };

        if (Re !== undefined && Pr !== undefined) {
          const Nu = dittusBoelter(Re, Pr);
          const hCalc = Nu * k / L;
          convResult.forced_convection = {
            reynolds_number: Re,
            prandtl_number: Pr,
            nusselt_number: Math.round(Nu * 100) / 100,
            calculated_h_W_m2K: Math.round(hCalc * 100) / 100,
          };
        }

        result = convResult;
        break;
      }

      case 'radiation': {
        const { T1 = 500, T2 = 300, epsilon = 0.8, A = 1 } = args;
        const E1 = blackbodyEmission(T1);
        const Q = grayBodyRadiation(epsilon, A, T1);
        const Qnet = radiationExchange(epsilon, epsilon, A, T1, T2);
        const lambdaMax = wiensLaw(T1);

        result = {
          operation: 'radiation',
          parameters: {
            T1_K: T1,
            T2_K: T2,
            emissivity: epsilon,
            area_m2: A,
          },
          blackbody_emission_W_m2: Math.round(E1),
          gray_body_emission_W: Math.round(Q),
          net_radiation_exchange_W: Math.round(Qnet),
          peak_wavelength_um: Math.round(lambdaMax * 100) / 100,
          stefan_boltzmann_constant: STEFAN_BOLTZMANN,
        };
        break;
      }

      case 'exchanger': {
        const { Thi = 400, Tho = 350, Tci = 300, Tco = 340, U = 500, A = 10 } = args;
        const LMTD_val = lmtd(Thi, Tho, Tci, Tco);
        const Q = heatExchangerDuty(U, A, LMTD_val);

        // Assume water with Cp = 4186 J/kg·K for capacity rate
        const Cp = 4186;
        const mDotH = Q / (Cp * (Thi - Tho));
        const mDotC = Q / (Cp * (Tco - Tci));

        const Cmin = Math.min(mDotH, mDotC) * Cp;
        const Cmax = Math.max(mDotH, mDotC) * Cp;
        const Cr = Cmin / Cmax;
        const NTU = ntu(U, A, Cmin);
        const eff = effectiveness_counterflow(NTU, Cr);

        result = {
          operation: 'exchanger',
          temperatures: {
            hot_inlet_K: Thi,
            hot_outlet_K: Tho,
            cold_inlet_K: Tci,
            cold_outlet_K: Tco,
          },
          LMTD_K: Math.round(LMTD_val * 100) / 100,
          overall_U_W_m2K: U,
          area_m2: A,
          heat_duty_W: Math.round(Q),
          heat_duty_kW: Math.round(Q / 1000 * 100) / 100,
          NTU_method: {
            NTU: Math.round(NTU * 1000) / 1000,
            capacity_ratio_Cr: Math.round(Cr * 1000) / 1000,
            effectiveness: Math.round(eff * 1000) / 1000,
          },
        };
        break;
      }

      case 'fin': {
        const { h = 50, k = 200, L = 0.05, thickness = 0.002, width = 0.1 } = args;
        const P = 2 * (thickness + width);
        const Ac = thickness * width;
        const m = finParameter(h, P, k, Ac);
        const eta = finEfficiency(m, L);

        result = {
          operation: 'fin',
          parameters: {
            h_W_m2K: h,
            k_W_mK: k,
            length_m: L,
            thickness_m: thickness,
            width_m: width,
          },
          fin_parameter_m: Math.round(m * 100) / 100,
          mL_product: Math.round(m * L * 1000) / 1000,
          fin_efficiency: Math.round(eta * 1000) / 1000,
          fin_efficiency_percent: Math.round(eta * 100),
          perimeter_m: P,
          cross_section_m2: Ac,
          recommendation: eta > 0.9 ? 'Efficient fin design' : eta > 0.7 ? 'Acceptable efficiency' : 'Consider shorter or thicker fin',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Heat Transfer Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isHeatTransferAvailable(): boolean { return true; }
