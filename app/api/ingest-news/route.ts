import { NextRequest, NextResponse } from 'next/server'
import { IngestionPipeline } from '@/lib/ingestion/pipeline'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting news ingestion...')
    
    // Check if this is a scheduled run (from Vercel cron)
    const userAgent = request.headers.get('user-agent') || ''
    const isScheduled = userAgent.includes('Vercel') || request.headers.get('x-vercel-cron') === '1'
    
    const pipeline = new IngestionPipeline()
    const result = await pipeline.runIngestion(isScheduled)
    
    console.log('Ingestion completed:', result)
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    console.error('Ingestion failed:', error)
    
    return NextResponse.json({
      success: false,
      error: String(error),
      providerCounts: {},
      totalItems: 0,
      dedupeRate: 0,
      lastRunTs: new Date().toISOString(),
      errors: [String(error)]
    }, { status: 500 })
  }
}

// Support GET for cron compatibility
export async function GET(request: NextRequest) {
  return POST(request)
}
