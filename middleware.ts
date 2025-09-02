import { NextRequest, NextResponse } from 'next/server'
import { rateLimits, checkRateLimit } from '@/lib/upstash'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rate limiting for ingestion API
  if (pathname.startsWith('/api/ingest-news')) {
    // Check if this is a scheduled cron job (allow these through)
    const isScheduled = request.headers.get('x-vercel-cron') === '1' || 
                       request.headers.get('user-agent')?.includes('Vercel')
    
    if (!isScheduled) {
      // Rate limit manual/external requests
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'
      const result = await checkRateLimit(rateLimits.ingestion, ip)
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: 'Rate limit exceeded for ingestion API',
          message: `Try again after ${result.reset.toISOString()}`,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset.getTime()
        }, { status: 429 })
      }
      
      // Add rate limit headers to response
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', result.limit.toString())
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      response.headers.set('X-RateLimit-Reset', result.reset.getTime().toString())
      
      return response
    }
  }
  
  // Rate limiting for general API routes
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/ingest-news')) {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'
    const result = await checkRateLimit(rateLimits.api, ip)
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again after ${result.reset.toISOString()}`,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset.getTime()
      }, { status: 429 })
    }
    
    // Add rate limit headers
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', result.limit.toString())
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
    response.headers.set('X-RateLimit-Reset', result.reset.getTime().toString())
    
    return response
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}