import { NextResponse } from 'next/server'
import { generateWithGateway } from '@/lib/ai-gateway'

export const runtime = 'edge'

export async function GET() {
  try {
    console.log('Testing AI Gateway...')
    
    const result = await generateWithGateway(
      'Find 2 recent news articles about Google. Return JSON format with title, url, source_domain, published_at, and company_mentioned fields.',
      'news',
      {
        maxTokens: 1000,
        temperature: 0.1
      }
    )
    
    console.log('AI Gateway result:', result)
    
    return NextResponse.json({
      success: true,
      result: result.text,
      usage: result.usage || null
    })
    
  } catch (error) {
    console.error('AI Gateway test error:', error)
    
    return NextResponse.json({
      success: false,
      error: String(error),
      message: 'AI Gateway test failed'
    }, { status: 500 })
  }
}
