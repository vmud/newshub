import { NextRequest, NextResponse } from 'next/server'
import { IngestionPipeline } from '@/lib/ingestion/pipeline'

export async function POST(request: NextRequest) {
  try {
    console.log('[INGEST] Starting news ingestion...')
    
    // Check if this is a scheduled run (from Vercel cron)
    const userAgent = request.headers.get('user-agent') || ''
    const isScheduled = userAgent.includes('Vercel') || request.headers.get('x-vercel-cron') === '1'
    
    const pipeline = new IngestionPipeline()
    const result = await pipeline.runIngestion(isScheduled)
    
    // Determine if the ingestion was successful based on results
    const hasErrors = result.errors && result.errors.length > 0
    const allProvidersFailed = Object.keys(result.providerCounts).length === 0
    
    // Consider it a failure if all providers failed or critical errors occurred
    const success = !allProvidersFailed && (!hasErrors || result.totalItems > 0)
    
    console.log(`[INGEST] Completed: success=${success}, items=${result.totalItems}, errors=${result.errors.length}`)
    
    if (!success) {
      console.error('[INGEST] Failed with errors:', result.errors)
      return NextResponse.json({
        success: false,
        message: 'Ingestion failed - no data retrieved',
        ...result
      }, { status: 500 })
    }
    
    // Partial success - some items were retrieved
    if (hasErrors && result.totalItems > 0) {
      console.warn('[INGEST] Partial success with errors:', result.errors)
      return NextResponse.json({
        success: true,
        warning: 'Partial ingestion - some providers failed',
        ...result
      }, { status: 207 }) // 207 Multi-Status
    }
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    console.error('[INGEST] Fatal error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Fatal error during ingestion',
      providerCounts: {},
      totalItems: 0,
      dedupeRate: 0,
      lastRunTs: new Date().toISOString(),
      errors: [error instanceof Error ? error.message : String(error)]
    }, { status: 500 })
  }
}

// Support GET for cron compatibility
export async function GET(request: NextRequest) {
  return POST(request)
}
