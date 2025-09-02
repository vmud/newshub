import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Redis client for Upstash using KV environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Rate limiting configurations for different endpoints
export const rateLimits = {
  // Ingestion API - limit to prevent abuse and control costs
  ingestion: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 requests per hour
    analytics: true,
    prefix: 'ratelimit:ingestion',
  }),
  
  // AI requests - more restrictive due to cost
  aiRequests: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 AI requests per hour
    analytics: true, 
    prefix: 'ratelimit:ai',
  }),
  
  // General API requests
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
    analytics: true,
    prefix: 'ratelimit:api',
  })
}

// Cache helpers for ingestion optimization
export const cache = {
  // Cache GDELT responses to avoid redundant calls
  async getArticleCache(provider: string, queryKey: string): Promise<Record<string, unknown>[] | null> {
    try {
      const key = `articles:${provider}:${queryKey}`
      const cached = await redis.get(key)
      return cached as Record<string, unknown>[] | null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  },

  async setArticleCache(provider: string, queryKey: string, articles: Record<string, unknown>[], ttlSeconds = 3600): Promise<void> {
    try {
      const key = `articles:${provider}:${queryKey}`
      await redis.setex(key, ttlSeconds, JSON.stringify(articles))
    } catch (error) {
      console.error('Cache set error:', error)
    }
  },

  // Cache processed article URLs for deduplication
  async isArticleProcessed(urlHash: string): Promise<boolean> {
    try {
      const exists = await redis.exists(`processed:${urlHash}`)
      return exists === 1
    } catch (error) {
      console.error('Cache check error:', error)
      return false
    }
  },

  async markArticleProcessed(urlHash: string, ttlSeconds = 86400 * 7): Promise<void> { // 7 days
    try {
      await redis.setex(`processed:${urlHash}`, ttlSeconds, '1')
    } catch (error) {
      console.error('Cache mark error:', error)
    }
  }
}

// Rate limiting helper with better error handling
export async function checkRateLimit(
  rateLimit: Ratelimit,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  try {
    const result = await rateLimit.limit(identifier)
    return {
      ...result,
      reset: new Date(result.reset)
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
    // Fail open - allow request but log the error
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: new Date()
    }
  }
}