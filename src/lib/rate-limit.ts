// /lib/rate-limit.ts
// Complete rate limiter with presets

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (for production, use Redis/Upstash)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function rateLimit(identifier: string, config: RateLimitConfig): { 
  success: boolean; 
  limit: number; 
  remaining: number; 
  reset: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

// ============================================
// ADDITIONS - EASY-TO-USE PRESETS
// ============================================

/**
 * Get client identifier (IP address) from request
 * Works with most hosting providers including Vercel
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP (works with Vercel, Netlify, etc.)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  return forwarded?.split(',')[0] || realIp || 'unknown';
}

/**
 * Preset configurations for common use cases
 * Customize these limits based on your needs
 */
export const rateLimitPresets = {
  // Login attempts: 5 attempts per 15 minutes
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  
  // Password reset: 3 attempts per hour
  passwordReset: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  
  // Signup: 3 attempts per hour per IP
  signup: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  
  // Messages: 20 per minute
  messages: { maxRequests: 20, windowMs: 60 * 1000 },
  
  // API calls: 30 per minute
  api: { maxRequests: 30, windowMs: 60 * 1000 },
};

/**
 * Easy wrapper functions for common rate limiting scenarios
 * Usage: rateLimiters.login(clientId)
 */
export const rateLimiters = {
  login: (identifier: string) => rateLimit(identifier, rateLimitPresets.login),
  passwordReset: (identifier: string) => rateLimit(identifier, rateLimitPresets.passwordReset),
  signup: (identifier: string) => rateLimit(identifier, rateLimitPresets.signup),
  messages: (identifier: string) => rateLimit(identifier, rateLimitPresets.messages),
  api: (identifier: string) => rateLimit(identifier, rateLimitPresets.api),
};