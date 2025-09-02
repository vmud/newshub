import { NextRequest, NextResponse } from 'next/server'

// Test rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 5, // Very low for testing
  windowMs: 60 * 1000, // 1 minute
}

// Simple in-memory rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const key = ip
  const current = rateLimitStore.get(key)
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT.windowMs })
    return true
  }
  
  if (current.count >= RATE_LIMIT.maxRequests) {
    return false
  }
  
  current.count++
  return true
}

export async function GET(request: NextRequest) {
  // Get client IP for rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  
  // Check rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT.windowMs / 1000),
        limit: RATE_LIMIT.maxRequests,
        window: RATE_LIMIT.windowMs
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil(RATE_LIMIT.windowMs / 1000).toString(),
          'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + RATE_LIMIT.windowMs).toISOString()
        }
      }
    )
  }
  
  // Get current rate limit info
  const current = rateLimitStore.get(ip)
  const remaining = current ? Math.max(0, RATE_LIMIT.maxRequests - current.count) : RATE_LIMIT.maxRequests - 1
  
  return NextResponse.json({
    success: true,
    message: 'Rate limit test endpoint',
    rateLimit: {
      limit: RATE_LIMIT.maxRequests,
      remaining,
      resetTime: current?.resetTime || Date.now() + RATE_LIMIT.windowMs,
      windowMs: RATE_LIMIT.windowMs
    },
    timestamp: new Date().toISOString()
  })
}
