import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  console.log('[TEST-DB] Starting database connection test')
  
  const result = {
    supabaseConfigured: !!supabase,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
    tests: {} as Record<string, unknown>
  }
  
  if (!supabase) {
    return NextResponse.json({
      ...result,
      error: 'Supabase client not configured'
    }, { status: 500 })
  }
  
  // Test 1: Check companies table
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, canonical_name')
      .limit(5)
    
    result.tests.companies = {
      success: !error,
      count: companies?.length || 0,
      data: companies,
      error: error?.message
    }
  } catch (e: unknown) {
    result.tests.companies = {
      success: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
  
  // Test 2: Check articles table
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title')
      .limit(5)
    
    result.tests.articles = {
      success: !error,
      count: articles?.length || 0,
      data: articles,
      error: error?.message
    }
  } catch (e: unknown) {
    result.tests.articles = {
      success: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
  
  // Test 3: Check ingestion_runs table
  try {
    const { data: runs, error } = await supabase
      .from('ingestion_runs')
      .select('provider, item_count, ts')
      .order('ts', { ascending: false })
      .limit(5)
    
    result.tests.ingestion_runs = {
      success: !error,
      count: runs?.length || 0,
      data: runs,
      error: error?.message
    }
  } catch (e: unknown) {
    result.tests.ingestion_runs = {
      success: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
  
  // Test 4: Try to insert a test article
  try {
    const testArticle = {
      company_id: 'test-company',
      title: 'Test Article ' + Date.now(),
      url: 'https://example.com/test-' + Date.now(),
      url_norm: 'https://example.com/test-' + Date.now(),
      source_domain: 'example.com',
      published_at: new Date().toISOString(),
      priority: 50,
      provider: 'test',
      raw_json: { test: true }
    }
    
    const { error } = await supabase
      .from('articles')
      .insert(testArticle)
    
    result.tests.insert = {
      success: !error,
      error: error?.message || error?.code
    }
  } catch (e: unknown) {
    result.tests.insert = {
      success: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
  
  console.log('[TEST-DB] Test results:', JSON.stringify(result, null, 2))
  
  return NextResponse.json(result)
}