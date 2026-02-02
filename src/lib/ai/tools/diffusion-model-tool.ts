/**
 * DIFFUSION-MODEL TOOL
 * Diffusion models for generation - THE TECH BEHIND DALL-E/STABLE DIFFUSION!
 *
 * Implements real diffusion model mathematics:
 * - Forward diffusion process (adding noise progressively)
 * - Reverse diffusion process (denoising/generation)
 * - Multiple schedulers: DDPM, DDIM, Euler, DPM++
 * - Noise schedules: linear, cosine, exponential
 * - Classifier-free guidance for conditional generation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const diffusionmodelTool: UnifiedTool = {
  name: 'diffusion_model',
  description: 'Diffusion models - denoising, score matching, sampling, guidance. Implements DDPM, DDIM, Euler, DPM++ schedulers with full mathematical foundations.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['forward', 'reverse', 'sample', 'guidance', 'schedule', 'denoise', 'train_step', 'info'],
        description: 'Operation: forward (add noise), reverse (denoise), sample (generate), guidance (CFG), schedule (compute betas/alphas), denoise (single step), train_step (compute loss), info (documentation)'
      },
      scheduler: {
        type: 'string',
        enum: ['DDPM', 'DDIM', 'Euler', 'DPM++'],
        description: 'Sampling scheduler algorithm'
      },
      schedule_type: {
        type: 'string',
        enum: ['linear', 'cosine', 'exponential', 'sigmoid'],
        description: 'Noise schedule type for beta computation'
      },
      timesteps: { type: 'integer', description: 'Total diffusion timesteps T (default 1000)' },
      current_step: { type: 'integer', description: 'Current timestep t for operations' },
      data: { type: 'array', items: { type: 'number' }, description: 'Input data vector x_0 or x_t' },
      noise: { type: 'array', items: { type: 'number' }, description: 'Noise vector epsilon' },
      predicted_noise: { type: 'array', items: { type: 'number' }, description: 'Model-predicted noise' },
      beta_start: { type: 'number', description: 'Starting beta value (default 0.0001)' },
      beta_end: { type: 'number', description: 'Ending beta value (default 0.02)' },
      guidance_scale: { type: 'number', description: 'Classifier-free guidance scale (default 7.5)' },
      conditional_pred: { type: 'array', items: { type: 'number' }, description: 'Conditional model prediction' },
      unconditional_pred: { type: 'array', items: { type: 'number' }, description: 'Unconditional model prediction' },
      eta: { type: 'number', description: 'DDIM eta parameter (0=deterministic, 1=DDPM)' },
      num_inference_steps: { type: 'integer', description: 'Number of inference steps for sampling' }
    },
    required: ['operation']
  }
};

// ============================================================================
// NOISE SCHEDULE COMPUTATIONS
// ============================================================================

interface NoiseSchedule {
  betas: number[];
  alphas: number[];
  alphas_cumprod: number[];
  alphas_cumprod_prev: number[];
  sqrt_alphas_cumprod: number[];
  sqrt_one_minus_alphas_cumprod: number[];
  sqrt_recip_alphas: number[];
  posterior_variance: number[];
}

/**
 * Compute linear noise schedule: beta_t = beta_start + t * (beta_end - beta_start) / T
 */
function linearSchedule(timesteps: number, beta_start: number, beta_end: number): number[] {
  const betas: number[] = [];
  for (let t = 0; t < timesteps; t++) {
    betas.push(beta_start + (t / (timesteps - 1)) * (beta_end - beta_start));
  }
  return betas;
}

/**
 * Compute cosine noise schedule (from "Improved Denoising Diffusion Probabilistic Models")
 * alpha_bar(t) = f(t) / f(0) where f(t) = cos((t/T + s) / (1 + s) * π/2)²
 */
function cosineSchedule(timesteps: number, s: number = 0.008): number[] {
  const alphas_cumprod: number[] = [];
  for (let t = 0; t <= timesteps; t++) {
    const f_t = Math.cos(((t / timesteps) + s) / (1 + s) * Math.PI / 2) ** 2;
    const f_0 = Math.cos((s / (1 + s)) * Math.PI / 2) ** 2;
    alphas_cumprod.push(f_t / f_0);
  }

  // Convert alpha_cumprod to betas
  const betas: number[] = [];
  for (let t = 1; t <= timesteps; t++) {
    const beta = 1 - (alphas_cumprod[t] / alphas_cumprod[t - 1]);
    betas.push(Math.min(Math.max(beta, 0.0001), 0.9999)); // Clip for stability
  }
  return betas;
}

/**
 * Compute exponential noise schedule: beta_t = beta_start * (beta_end/beta_start)^(t/T)
 */
function exponentialSchedule(timesteps: number, beta_start: number, beta_end: number): number[] {
  const betas: number[] = [];
  const ratio = beta_end / beta_start;
  for (let t = 0; t < timesteps; t++) {
    betas.push(beta_start * Math.pow(ratio, t / (timesteps - 1)));
  }
  return betas;
}

/**
 * Compute sigmoid noise schedule
 */
function sigmoidSchedule(timesteps: number, beta_start: number, beta_end: number): number[] {
  const betas: number[] = [];
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  for (let t = 0; t < timesteps; t++) {
    const x = (t / (timesteps - 1)) * 12 - 6; // Map to [-6, 6]
    const s = sigmoid(x);
    betas.push(beta_start + s * (beta_end - beta_start));
  }
  return betas;
}

/**
 * Compute full noise schedule with all derived quantities
 */
function computeNoiseSchedule(
  timesteps: number,
  schedule_type: string,
  beta_start: number,
  beta_end: number
): NoiseSchedule {
  let betas: number[];

  switch (schedule_type) {
    case 'cosine':
      betas = cosineSchedule(timesteps);
      break;
    case 'exponential':
      betas = exponentialSchedule(timesteps, beta_start, beta_end);
      break;
    case 'sigmoid':
      betas = sigmoidSchedule(timesteps, beta_start, beta_end);
      break;
    case 'linear':
    default:
      betas = linearSchedule(timesteps, beta_start, beta_end);
  }

  // Compute alphas: α_t = 1 - β_t
  const alphas = betas.map(b => 1 - b);

  // Compute cumulative products: ᾱ_t = ∏_{s=1}^t α_s
  const alphas_cumprod: number[] = [];
  let cumprod = 1;
  for (const alpha of alphas) {
    cumprod *= alpha;
    alphas_cumprod.push(cumprod);
  }

  // Previous cumulative products (for posterior computation)
  const alphas_cumprod_prev = [1, ...alphas_cumprod.slice(0, -1)];

  // Precompute commonly used quantities
  const sqrt_alphas_cumprod = alphas_cumprod.map(a => Math.sqrt(a));
  const sqrt_one_minus_alphas_cumprod = alphas_cumprod.map(a => Math.sqrt(1 - a));
  const sqrt_recip_alphas = alphas.map(a => 1 / Math.sqrt(a));

  // Posterior variance: β̃_t = β_t * (1 - ᾱ_{t-1}) / (1 - ᾱ_t)
  const posterior_variance: number[] = [];
  for (let t = 0; t < timesteps; t++) {
    const var_t = betas[t] * (1 - alphas_cumprod_prev[t]) / (1 - alphas_cumprod[t]);
    posterior_variance.push(var_t);
  }

  return {
    betas,
    alphas,
    alphas_cumprod,
    alphas_cumprod_prev,
    sqrt_alphas_cumprod,
    sqrt_one_minus_alphas_cumprod,
    sqrt_recip_alphas,
    posterior_variance
  };
}

// ============================================================================
// FORWARD DIFFUSION PROCESS
// ============================================================================

/**
 * Forward diffusion: q(x_t | x_0) = N(x_t; √ᾱ_t x_0, (1-ᾱ_t)I)
 * x_t = √ᾱ_t * x_0 + √(1-ᾱ_t) * ε
 */
function forwardDiffusion(
  x_0: number[],
  t: number,
  schedule: NoiseSchedule,
  noise?: number[]
): { x_t: number[]; noise: number[]; signal_rate: number; noise_rate: number } {
  // Generate random noise if not provided
  const epsilon = noise || x_0.map(() => gaussianRandom());

  const sqrt_alpha_cumprod = schedule.sqrt_alphas_cumprod[t];
  const sqrt_one_minus_alpha_cumprod = schedule.sqrt_one_minus_alphas_cumprod[t];

  // x_t = √ᾱ_t * x_0 + √(1-ᾱ_t) * ε
  const x_t = x_0.map((x, i) =>
    sqrt_alpha_cumprod * x + sqrt_one_minus_alpha_cumprod * epsilon[i]
  );

  return {
    x_t,
    noise: epsilon,
    signal_rate: sqrt_alpha_cumprod,
    noise_rate: sqrt_one_minus_alpha_cumprod
  };
}

/**
 * Generate Gaussian random number using Box-Muller transform
 */
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ============================================================================
// REVERSE DIFFUSION PROCESS (SAMPLING)
// ============================================================================

/**
 * DDPM reverse step: p(x_{t-1} | x_t)
 * x_{t-1} = 1/√α_t * (x_t - β_t/√(1-ᾱ_t) * ε_θ(x_t, t)) + σ_t * z
 */
function ddpmStep(
  x_t: number[],
  predicted_noise: number[],
  t: number,
  schedule: NoiseSchedule
): number[] {
  const alpha = schedule.alphas[t];
  const alpha_cumprod = schedule.alphas_cumprod[t];
  const beta = schedule.betas[t];

  // Compute mean: μ_θ(x_t, t) = 1/√α_t * (x_t - β_t/√(1-ᾱ_t) * ε_θ)
  const sqrt_recip_alpha = 1 / Math.sqrt(alpha);
  const noise_coef = beta / Math.sqrt(1 - alpha_cumprod);

  const mean = x_t.map((x, i) =>
    sqrt_recip_alpha * (x - noise_coef * predicted_noise[i])
  );

  // Add noise (except at t=0)
  if (t > 0) {
    const sigma = Math.sqrt(schedule.posterior_variance[t]);
    return mean.map(m => m + sigma * gaussianRandom());
  }

  return mean;
}

/**
 * DDIM reverse step (deterministic or stochastic based on eta)
 * Allows faster sampling with fewer steps
 */
function ddimStep(
  x_t: number[],
  predicted_noise: number[],
  t: number,
  t_prev: number,
  schedule: NoiseSchedule,
  eta: number = 0
): number[] {
  const alpha_cumprod_t = schedule.alphas_cumprod[t];
  const alpha_cumprod_prev = t_prev >= 0 ? schedule.alphas_cumprod[t_prev] : 1;

  // Predicted x_0 from noise prediction
  const sqrt_alpha_t = Math.sqrt(alpha_cumprod_t);
  const sqrt_one_minus_alpha_t = Math.sqrt(1 - alpha_cumprod_t);

  const pred_x_0 = x_t.map((x, i) =>
    (x - sqrt_one_minus_alpha_t * predicted_noise[i]) / sqrt_alpha_t
  );

  // Compute sigma for stochasticity
  const sigma_t = eta * Math.sqrt(
    (1 - alpha_cumprod_prev) / (1 - alpha_cumprod_t) *
    (1 - alpha_cumprod_t / alpha_cumprod_prev)
  );

  // Direction pointing to x_t
  const sqrt_one_minus_alpha_prev_minus_sigma = Math.sqrt(
    Math.max(0, 1 - alpha_cumprod_prev - sigma_t * sigma_t)
  );

  // Compute x_{t-1}
  const sqrt_alpha_prev = Math.sqrt(alpha_cumprod_prev);

  return x_t.map((_, i) =>
    sqrt_alpha_prev * pred_x_0[i] +
    sqrt_one_minus_alpha_prev_minus_sigma * predicted_noise[i] +
    sigma_t * gaussianRandom()
  );
}

/**
 * Euler method step (first-order ODE solver)
 */
function eulerStep(
  x_t: number[],
  predicted_noise: number[],
  t: number,
  t_prev: number,
  schedule: NoiseSchedule
): number[] {
  const sigma_t = Math.sqrt(1 - schedule.alphas_cumprod[t]);
  const sigma_prev = t_prev >= 0 ? Math.sqrt(1 - schedule.alphas_cumprod[t_prev]) : 0;

  // Convert noise prediction to score: score = -ε / σ
  const score = predicted_noise.map(e => -e / sigma_t);

  // Euler step: x_{t-1} = x_t + (σ_prev - σ_t) * score * σ_t
  const dt = sigma_prev - sigma_t;

  return x_t.map((x, i) => x + dt * score[i] * sigma_t);
}

/**
 * DPM++ (2M) step - fast high-quality sampler
 * Second-order solver using previous predictions
 */
function dpmPlusPlusStep(
  x_t: number[],
  predicted_noise: number[],
  prev_predicted_noise: number[] | null,
  t: number,
  t_prev: number,
  schedule: NoiseSchedule
): { x_prev: number[]; for_next: number[] } {
  const lambda_t = -Math.log(Math.sqrt(1 - schedule.alphas_cumprod[t]) / Math.sqrt(schedule.alphas_cumprod[t]));
  const lambda_prev = t_prev >= 0
    ? -Math.log(Math.sqrt(1 - schedule.alphas_cumprod[t_prev]) / Math.sqrt(schedule.alphas_cumprod[t_prev]))
    : lambda_t;

  const h = lambda_prev - lambda_t;
  const alpha_t = Math.sqrt(schedule.alphas_cumprod[t]);
  const sigma_t = Math.sqrt(1 - schedule.alphas_cumprod[t]);
  const alpha_prev = t_prev >= 0 ? Math.sqrt(schedule.alphas_cumprod[t_prev]) : 1;
  const sigma_prev = t_prev >= 0 ? Math.sqrt(1 - schedule.alphas_cumprod[t_prev]) : 0;

  // Data prediction (denoised estimate)
  const pred_x_0 = x_t.map((x, i) => (x - sigma_t * predicted_noise[i]) / alpha_t);

  // First-order update
  let x_prev: number[];

  if (prev_predicted_noise && h > 0.001) {
    // Second-order correction (DPM++ 2M)
    const prev_pred_x_0 = prev_predicted_noise; // This should be stored pred_x_0 from previous step
    const r = h / (2 * h); // Simplified for uniform spacing

    x_prev = x_t.map((x, i) => {
      const D = pred_x_0[i];
      const D_prev = prev_pred_x_0[i];
      return alpha_prev * D + sigma_prev * ((1 + 1/(2*r)) * (D - x/alpha_t) - (1/(2*r)) * (D_prev - x/alpha_t));
    });
  } else {
    // First-order (DPM++ 1)
    x_prev = pred_x_0.map((d, i) => alpha_prev * d + sigma_prev * predicted_noise[i]);
  }

  return { x_prev, for_next: pred_x_0 };
}

// ============================================================================
// CLASSIFIER-FREE GUIDANCE
// ============================================================================

/**
 * Apply classifier-free guidance
 * ε_guided = ε_uncond + w * (ε_cond - ε_uncond)
 * where w is the guidance scale
 */
function applyGuidance(
  conditional_pred: number[],
  unconditional_pred: number[],
  guidance_scale: number
): number[] {
  return unconditional_pred.map((uncond, i) =>
    uncond + guidance_scale * (conditional_pred[i] - uncond)
  );
}

// ============================================================================
// TRAINING UTILITIES
// ============================================================================

/**
 * Compute diffusion training loss (simplified MSE between predicted and true noise)
 */
function computeTrainingLoss(
  true_noise: number[],
  predicted_noise: number[]
): { mse: number; mae: number; max_error: number } {
  let mse = 0;
  let mae = 0;
  let max_error = 0;

  for (let i = 0; i < true_noise.length; i++) {
    const error = predicted_noise[i] - true_noise[i];
    mse += error * error;
    mae += Math.abs(error);
    max_error = Math.max(max_error, Math.abs(error));
  }

  return {
    mse: mse / true_noise.length,
    mae: mae / true_noise.length,
    max_error
  };
}

/**
 * Sample random timesteps for training
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sampleTimesteps(batch_size: number, max_t: number): number[] {
  return Array(batch_size).fill(0).map(() => Math.floor(Math.random() * max_t));
}

// ============================================================================
// FULL SAMPLING LOOP
// ============================================================================

/**
 * Generate samples using full reverse diffusion
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateSamples(
  dimensions: number,
  num_samples: number,
  schedule: NoiseSchedule,
  num_inference_steps: number,
  predictNoise: (x: number[], t: number) => number[],
  scheduler: string,
  guidance_scale?: number,
  predictNoiseUncond?: (x: number[], t: number) => number[]
): number[][] {
  const T = schedule.betas.length;
  const step_size = Math.floor(T / num_inference_steps);
  const timesteps = Array.from({ length: num_inference_steps }, (_, i) => T - 1 - i * step_size);

  // Initialize with pure noise
  const samples: number[][] = Array(num_samples).fill(0).map(() =>
    Array(dimensions).fill(0).map(() => gaussianRandom())
  );

  let prev_pred: number[] | null = null;

  for (let i = 0; i < timesteps.length; i++) {
    const t = timesteps[i];
    const t_prev = i < timesteps.length - 1 ? timesteps[i + 1] : -1;

    for (let s = 0; s < samples.length; s++) {
      let predicted_noise = predictNoise(samples[s], t);

      // Apply classifier-free guidance if specified
      if (guidance_scale && guidance_scale > 1 && predictNoiseUncond) {
        const uncond_pred = predictNoiseUncond(samples[s], t);
        predicted_noise = applyGuidance(predicted_noise, uncond_pred, guidance_scale);
      }

      // Apply appropriate scheduler step
      switch (scheduler) {
        case 'DDIM':
          samples[s] = ddimStep(samples[s], predicted_noise, t, t_prev, schedule, 0);
          break;
        case 'Euler':
          samples[s] = eulerStep(samples[s], predicted_noise, t, t_prev, schedule);
          break;
        case 'DPM++':
          const result = dpmPlusPlusStep(samples[s], predicted_noise, prev_pred, t, t_prev, schedule);
          samples[s] = result.x_prev;
          prev_pred = result.for_next;
          break;
        case 'DDPM':
        default:
          samples[s] = ddpmStep(samples[s], predicted_noise, t, schedule);
      }
    }
  }

  return samples;
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executediffusionmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation = 'info',
      scheduler = 'DDPM',
      schedule_type = 'linear',
      timesteps = 1000,
      current_step,
      data,
      noise,
      predicted_noise,
      beta_start = 0.0001,
      beta_end = 0.02,
      guidance_scale = 7.5,
      conditional_pred,
      unconditional_pred,
      eta = 0,
      num_inference_steps = 50
    } = args;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'schedule': {
        // Compute and return noise schedule
        const schedule = computeNoiseSchedule(timesteps, schedule_type, beta_start, beta_end);

        // Return summary statistics
        const summary = {
          schedule_type,
          timesteps,
          beta_start: schedule.betas[0],
          beta_end: schedule.betas[schedule.betas.length - 1],
          alpha_cumprod_start: schedule.alphas_cumprod[0],
          alpha_cumprod_end: schedule.alphas_cumprod[schedule.alphas_cumprod.length - 1],
          snr_start: schedule.alphas_cumprod[0] / (1 - schedule.alphas_cumprod[0]),
          snr_end: schedule.alphas_cumprod[timesteps - 1] / (1 - schedule.alphas_cumprod[timesteps - 1]),
          // Sample values at key timesteps
          sample_timesteps: [0, Math.floor(timesteps/4), Math.floor(timesteps/2), Math.floor(3*timesteps/4), timesteps-1],
          sample_betas: [0, Math.floor(timesteps/4), Math.floor(timesteps/2), Math.floor(3*timesteps/4), timesteps-1]
            .map(t => schedule.betas[t]),
          sample_alphas_cumprod: [0, Math.floor(timesteps/4), Math.floor(timesteps/2), Math.floor(3*timesteps/4), timesteps-1]
            .map(t => schedule.alphas_cumprod[t])
        };

        result = {
          operation: 'schedule',
          schedule_type,
          summary,
          description: `Computed ${schedule_type} noise schedule with ${timesteps} timesteps. ` +
            `SNR ranges from ${summary.snr_start.toFixed(4)} to ${summary.snr_end.toExponential(2)}.`
        };
        break;
      }

      case 'forward': {
        // Forward diffusion: add noise to data
        if (!data || data.length === 0) {
          throw new Error('Data array required for forward diffusion');
        }

        const t = current_step !== undefined ? current_step : Math.floor(timesteps / 2);
        const schedule = computeNoiseSchedule(timesteps, schedule_type, beta_start, beta_end);
        const forward_result = forwardDiffusion(data, t, schedule, noise);

        result = {
          operation: 'forward',
          timestep: t,
          total_timesteps: timesteps,
          x_0: data,
          x_t: forward_result.x_t,
          noise_added: forward_result.noise,
          signal_rate: forward_result.signal_rate,
          noise_rate: forward_result.noise_rate,
          snr: (forward_result.signal_rate ** 2) / (forward_result.noise_rate ** 2),
          description: `Forward diffusion at t=${t}/${timesteps}. ` +
            `Signal rate: ${forward_result.signal_rate.toFixed(4)}, ` +
            `Noise rate: ${forward_result.noise_rate.toFixed(4)}`
        };
        break;
      }

      case 'reverse':
      case 'denoise': {
        // Single reverse/denoise step
        if (!data || data.length === 0) {
          throw new Error('Data array (x_t) required for reverse diffusion');
        }
        if (!predicted_noise || predicted_noise.length === 0) {
          throw new Error('Predicted noise array required for reverse diffusion');
        }

        const t = current_step !== undefined ? current_step : 500;
        const t_prev = Math.max(0, t - Math.floor(timesteps / num_inference_steps));
        const schedule = computeNoiseSchedule(timesteps, schedule_type, beta_start, beta_end);

        let x_prev: number[];
        let scheduler_info: string;

        switch (scheduler) {
          case 'DDIM':
            x_prev = ddimStep(data, predicted_noise, t, t_prev, schedule, eta);
            scheduler_info = `DDIM (eta=${eta})`;
            break;
          case 'Euler':
            x_prev = eulerStep(data, predicted_noise, t, t_prev, schedule);
            scheduler_info = 'Euler (first-order ODE)';
            break;
          case 'DPM++':
            const dpm_result = dpmPlusPlusStep(data, predicted_noise, null, t, t_prev, schedule);
            x_prev = dpm_result.x_prev;
            scheduler_info = 'DPM++ (fast sampling)';
            break;
          case 'DDPM':
          default:
            x_prev = ddpmStep(data, predicted_noise, t, schedule);
            scheduler_info = 'DDPM (standard)';
        }

        result = {
          operation: 'reverse',
          scheduler,
          scheduler_info,
          timestep_from: t,
          timestep_to: t_prev,
          x_t: data,
          x_t_minus_1: x_prev,
          predicted_noise,
          description: `Reverse diffusion step from t=${t} to t=${t_prev} using ${scheduler_info}`
        };
        break;
      }

      case 'sample': {
        // Generate samples using mock noise predictor (demonstrates full pipeline)
        const dimensions = data?.length || 2;
        const schedule = computeNoiseSchedule(timesteps, schedule_type, beta_start, beta_end);

        // Mock noise predictor - in practice this would be a trained neural network
        const mockPredictNoise = (x: number[], t: number): number[] => {
          // Simple mock: predict noise that would move toward origin
          const alpha_t = schedule.sqrt_alphas_cumprod[t];
          return x.map(xi => xi * (1 - alpha_t) / schedule.sqrt_one_minus_alphas_cumprod[t]);
        };

        // Generate single sample for demonstration
        let x = Array(dimensions).fill(0).map(() => gaussianRandom());
        const trajectory: { t: number; x: number[]; noise_level: number }[] = [];

        const step_size = Math.floor(timesteps / num_inference_steps);
        for (let step = 0; step < num_inference_steps; step++) {
          const t = timesteps - 1 - step * step_size;
          const t_prev = Math.max(0, t - step_size);

          if (step % Math.floor(num_inference_steps / 5) === 0) {
            trajectory.push({
              t,
              x: [...x],
              noise_level: schedule.sqrt_one_minus_alphas_cumprod[t]
            });
          }

          const pred_noise = mockPredictNoise(x, t);

          switch (scheduler) {
            case 'DDIM':
              x = ddimStep(x, pred_noise, t, t_prev, schedule, eta);
              break;
            case 'Euler':
              x = eulerStep(x, pred_noise, t, t_prev, schedule);
              break;
            case 'DPM++':
              x = dpmPlusPlusStep(x, pred_noise, null, t, t_prev, schedule).x_prev;
              break;
            default:
              x = ddpmStep(x, pred_noise, t, schedule);
          }
        }

        trajectory.push({ t: 0, x: [...x], noise_level: 0 });

        result = {
          operation: 'sample',
          scheduler,
          num_inference_steps,
          dimensions,
          final_sample: x,
          trajectory_samples: trajectory,
          description: `Generated ${dimensions}D sample using ${scheduler} scheduler with ${num_inference_steps} steps`
        };
        break;
      }

      case 'guidance': {
        // Apply classifier-free guidance
        if (!conditional_pred || !unconditional_pred) {
          throw new Error('Both conditional_pred and unconditional_pred required for guidance');
        }
        if (conditional_pred.length !== unconditional_pred.length) {
          throw new Error('Conditional and unconditional predictions must have same length');
        }

        const guided = applyGuidance(conditional_pred, unconditional_pred, guidance_scale);

        // Compute guidance effect
        const amplification = guided.map((g, i) => g - unconditional_pred[i]);
        const guidance_magnitude = Math.sqrt(amplification.reduce((sum, a) => sum + a * a, 0));

        result = {
          operation: 'guidance',
          guidance_scale,
          conditional_pred,
          unconditional_pred,
          guided_prediction: guided,
          guidance_direction: amplification,
          guidance_magnitude,
          description: `Applied classifier-free guidance with scale ${guidance_scale}. ` +
            `Guidance magnitude: ${guidance_magnitude.toFixed(4)}`
        };
        break;
      }

      case 'train_step': {
        // Simulate training step
        if (!data || data.length === 0) {
          throw new Error('Data required for training step');
        }

        const schedule = computeNoiseSchedule(timesteps, schedule_type, beta_start, beta_end);

        // Sample random timestep
        const t = Math.floor(Math.random() * timesteps);

        // Add noise (forward process)
        const forward_result = forwardDiffusion(data, t, schedule);

        // Mock model prediction (would be neural network output)
        const mock_prediction = forward_result.noise.map(n => n + 0.1 * gaussianRandom());

        // Compute loss
        const loss = computeTrainingLoss(forward_result.noise, mock_prediction);

        result = {
          operation: 'train_step',
          timestep: t,
          x_0: data,
          x_t: forward_result.x_t,
          true_noise: forward_result.noise,
          predicted_noise: mock_prediction,
          loss,
          description: `Training step at t=${t}. MSE Loss: ${loss.mse.toFixed(6)}, MAE: ${loss.mae.toFixed(6)}`
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'diffusion_model',
          description: 'Diffusion models for generative AI - the technology behind DALL-E, Stable Diffusion, and more',
          theory: {
            forward_process: 'q(x_t|x_0) = N(x_t; √ᾱ_t·x_0, (1-ᾱ_t)·I) - gradually add Gaussian noise',
            reverse_process: 'p_θ(x_{t-1}|x_t) - learned denoising that generates data from noise',
            training_objective: 'E[||ε - ε_θ(x_t, t)||²] - predict added noise at each timestep',
            sampling: 'Start from pure noise x_T ~ N(0,I), iteratively denoise to get x_0'
          },
          schedulers: {
            DDPM: 'Denoising Diffusion Probabilistic Models - original algorithm, 1000 steps typical',
            DDIM: 'Denoising Diffusion Implicit Models - deterministic, faster (50-100 steps)',
            Euler: 'First-order ODE solver - treats diffusion as continuous-time process',
            'DPM++': 'DPM-Solver++ - fast high-quality sampling (20-50 steps)'
          },
          noise_schedules: {
            linear: 'β_t increases linearly from β_start to β_end',
            cosine: 'Improved schedule that preserves more signal at end of process',
            exponential: 'β_t = β_start * (β_end/β_start)^(t/T)',
            sigmoid: 'S-shaped transition between β_start and β_end'
          },
          guidance: {
            classifier_free: 'ε_guided = ε_uncond + w*(ε_cond - ε_uncond)',
            typical_scale: 'w = 7.5 is common for text-to-image generation'
          },
          operations: {
            schedule: 'Compute noise schedule (betas, alphas, derived quantities)',
            forward: 'Add noise to data at timestep t',
            reverse: 'Single denoising step from t to t-1',
            sample: 'Full sampling loop to generate from noise',
            guidance: 'Apply classifier-free guidance to predictions',
            train_step: 'Simulate one training iteration'
          },
          key_equations: [
            'x_t = √ᾱ_t·x_0 + √(1-ᾱ_t)·ε  (forward process)',
            'x_{t-1} = (1/√α_t)(x_t - β_t/√(1-ᾱ_t)·ε_θ) + σ_t·z  (DDPM reverse)',
            'SNR(t) = ᾱ_t/(1-ᾱ_t)  (signal-to-noise ratio)'
          ]
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify({
        error: errorMessage,
        tool: 'diffusion_model',
        hint: 'Use operation="info" for documentation and available operations'
      }, null, 2),
      isError: true
    };
  }
}

export function isdiffusionmodelAvailable(): boolean {
  return true;
}
