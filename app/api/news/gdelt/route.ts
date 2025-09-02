import { NextRequest, NextResponse } from 'next/server'
import { GDELTProvider } from '@/lib/providers/gdelt'
import { ProviderArticle } from '@/lib/providers/types'

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 100, // per hour
  windowMs: 60 * 60 * 1000, // 1 hour
}

// Simple in-memory rate limiting (for demo purposes)
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
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    
    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT.windowMs / 1000)
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
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const companies = searchParams.get('companies')?.split(',') || []
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '25')
    
    if (companies.length === 0) {
      return NextResponse.json(
        { error: 'Missing required parameter: companies' },
        { status: 400 }
      )
    }
    
    // Parse since date
    const sinceDt = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    // Initialize GDELT provider
    const provider = new GDELTProvider()
    
    // Fetch articles
    const articles = await provider.fetch(companies, sinceDt)
    
    // Normalize to ProviderArticle contract
    const normalizedArticles: ProviderArticle[] = articles.slice(0, limit).map(article => ({
      title: article.title,
      url: article.url,
      source_domain: article.source_domain,
      published_at: article.published_at,
      company_slug: article.company_slug,
      provider: 'gdelt',
      raw_json: article.raw_json
    }))
    
    // Log the request for observability
    console.log(`GDELT proxy request: ${companies.join(',')} -> ${normalizedArticles.length} articles`)
    
    return NextResponse.json({
      success: true,
      provider: 'gdelt',
      articles: normalizedArticles,
      count: normalizedArticles.length,
      companies_searched: companies,
      since: sinceDt.toISOString(),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('GDELT proxy error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: String(error),
        provider: 'gdelt',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Support POST for compatibility with ingestion pipeline
export async function POST(request: NextRequest) {
  return GET(request)
}
