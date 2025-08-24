import { NextRequest } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class InMemoryRateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getClientId(request: NextRequest): string {
    // Try to get client IP from various headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    const clientIp = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
    
    // For API routes, we might want to also consider the user agent
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    return `${clientIp}-${userAgent.substring(0, 50)}`;
  }

  public checkLimit(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
    const clientId = this.getClientId(request);
    const now = Date.now();
    const resetTime = now + this.windowMs;

    if (!this.store[clientId] || this.store[clientId].resetTime < now) {
      // First request or window expired
      this.store[clientId] = {
        count: 1,
        resetTime,
      };

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime,
      };
    }

    // Window is still active
    this.store[clientId].count++;

    const allowed = this.store[clientId].count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - this.store[clientId].count);

    return {
      allowed,
      remaining,
      resetTime: this.store[clientId].resetTime,
    };
  }
}

// Create a singleton instance
const rateLimiter = new InMemoryRateLimiter(
  60000, // 1 minute window
  parseInt(process.env.RATE_LIMIT_REQUESTS || '100')
);

export function rateLimit(request: NextRequest) {
  const result = rateLimiter.checkLimit(request);

  return {
    ...result,
    headers: {
      'X-RateLimit-Limit': process.env.RATE_LIMIT_REQUESTS || '100',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    },
  };
}

export class RateLimitError extends Error {
  constructor(public resetTime: number, public remaining: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}