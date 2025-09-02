import { NextRequest, NextResponse } from 'next/server'
import { ProviderArticle } from '@/lib/providers/types'

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 50, // per hour (EDGAR has stricter limits)
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

// EDGAR API configuration (for future use)
// const EDGAR_BASE_URL = 'https://data.sec.gov/api/xbrl/companyfacts'
// const EDGAR_SEARCH_URL = 'https://www.sec.gov/edgar/search'

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
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (companies.length === 0) {
      return NextResponse.json(
        { error: 'Missing required parameter: companies' },
        { status: 400 }
      )
    }
    
    // Parse since date
    const sinceDt = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days for filings
    
    // Fetch filings for each company
    const allFilings: ProviderArticle[] = []
    
    for (const company of companies) {
      try {
        const filings = await fetchCompanyFilings(company, sinceDt)
        allFilings.push(...filings)
      } catch (error) {
        console.error(`EDGAR error for ${company}:`, error)
        // Continue with other companies
      }
    }
    
    // Normalize and limit results
    const normalizedFilings: ProviderArticle[] = allFilings
      .slice(0, limit)
      .map(filing => ({
        title: filing.title,
        url: filing.url,
        source_domain: filing.source_domain,
        published_at: filing.published_at,
        company_slug: filing.company_slug,
        provider: 'sec_edgar',
        raw_json: filing.raw_json
      }))
    
    // Log the request for observability
    console.log(`EDGAR proxy request: ${companies.length} companies -> ${normalizedFilings.length} filings`)
    
    return NextResponse.json({
      success: true,
      provider: 'sec_edgar',
      articles: normalizedFilings,
      count: normalizedFilings.length,
      companies_searched: companies,
      since: sinceDt.toISOString(),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('EDGAR proxy error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: String(error),
        provider: 'sec_edgar',
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

async function fetchCompanyFilings(company: string, sinceDt: Date): Promise<ProviderArticle[]> {
  const filings: ProviderArticle[] = []
  
  try {
    // For demo purposes, we'll simulate EDGAR filings
    // In a real implementation, you would query the SEC EDGAR API
    
    // Mock some recent filings for the company
    const mockFilings = [
      {
        title: `${company} - 10-K Annual Report`,
        url: `https://www.sec.gov/Archives/edgar/data/1234567/000123456724000001/0001234567-24-000001-index.htm`,
        published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        form_type: '10-K'
      },
      {
        title: `${company} - 8-K Current Report`,
        url: `https://www.sec.gov/Archives/edgar/data/1234567/000123456724000002/0001234567-24-000002-index.htm`,
        published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        form_type: '8-K'
      },
      {
        title: `${company} - 10-Q Quarterly Report`,
        url: `https://www.sec.gov/Archives/edgar/data/1234567/000123456724000003/0001234567-24-000003-index.htm`,
        published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        form_type: '10-Q'
      }
    ]
    
    for (const filing of mockFilings) {
      if (new Date(filing.published_at) >= sinceDt) {
        filings.push({
          title: filing.title,
          url: filing.url,
          source_domain: 'sec.gov',
          published_at: filing.published_at,
          company_slug: company.toLowerCase(),
          provider: 'sec_edgar',
          raw_json: {
            form_type: filing.form_type,
            company: company,
            filing_date: filing.published_at
          }
        })
      }
    }
    
  } catch (error) {
    console.error(`Error fetching EDGAR filings for company:`, error)
  }
  
  return filings
}
