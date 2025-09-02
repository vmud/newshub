import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PerplexityProvider } from '@/lib/providers/perplexity'
import { GDELTProvider } from '@/lib/providers/gdelt'
import { AINewsProvider } from '@/lib/providers/ai-news'
import { NewsProvider, ProviderArticle, IngestionResult, IngestionRunSummary } from '@/lib/providers/types'
import { trackEvent } from '@/lib/telemetry'

// Company aliases from config - these should match the database canonical names
const COMPANY_ALIASES: Record<string, string[]> = {
  'Qualcomm': ['Qualcomm', 'Snapdragon'],
  'Google': ['Google', 'Android', 'Pixel'],
  'Samsung': ['Samsung', 'Galaxy'],
  'Whirlpool': ['Whirlpool', 'KitchenAid', 'Maytag'],
  'Best Buy': ['Best Buy', 'Geek Squad']
}

// Priority weights for source domains
const DOMAIN_PRIORITIES: Record<string, number> = {
  // Official domains (highest priority)
  'qualcomm.com': 100,
  'android.com': 100,
  'samsung.com': 100,
  'whirlpool.com': 100,
  'bestbuy.com': 100,
  
  // Tier-1 tech outlets
  'techcrunch.com': 95,
  'theverge.com': 95,
  'engadget.com': 90,
  'androidcentral.com': 90,
  'reuters.com': 95,
  'bloomberg.com': 95,
  'cnbc.com': 90,
  'wsj.com': 95,
  
  // Other outlets
  'default': 70
}

export class IngestionPipeline {
  private providers: NewsProvider[] = []

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    const enabledProviders = (process.env.NEWS_PROVIDERS || 'ai-news,gdelt').split(',')
    
    // Use AI Gateway for news ingestion (replaces Perplexity)
    if (enabledProviders.includes('ai-news')) {
      this.providers.push(new AINewsProvider())
    }
    
    // Keep Perplexity as fallback if explicitly enabled
    if (enabledProviders.includes('perplexity') && process.env.PPLX_API_KEY) {
      this.providers.push(new PerplexityProvider(process.env.PPLX_API_KEY))
    }
    
    if (enabledProviders.includes('gdelt')) {
      this.providers.push(new GDELTProvider())
    }
  }

  async runIngestion(scheduled: boolean = false): Promise<IngestionRunSummary> {
    const startTime = new Date()
    const results: IngestionResult[] = []
    const allErrors: string[] = []

    console.log(`[PIPELINE] Starting ingestion run (scheduled: ${scheduled})`)
    
    // Check if providers are initialized
    if (this.providers.length === 0) {
      const error = 'No providers configured - check NEWS_PROVIDERS environment variable'
      console.error(`[PIPELINE] ${error}`)
      allErrors.push(error)
      return {
        providerCounts: {},
        totalItems: 0,
        dedupeRate: 0,
        lastRunTs: startTime.toISOString(),
        errors: allErrors
      }
    }

    // Get all company aliases
    const allAliases = Object.values(COMPANY_ALIASES).flat()
    const sinceDt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days for better coverage
    
    console.log(`[PIPELINE] Processing ${allAliases.length} company aliases with ${this.providers.length} providers`)

    // Fetch from each provider
    for (const provider of this.providers) {
      try {
        console.log(`[PIPELINE] Fetching from provider: ${provider.name}`)
        const articles = await provider.fetch(allAliases, sinceDt)
        console.log(`[PIPELINE] Provider ${provider.name} returned ${articles.length} articles`)
        
        const processed = await this.processArticles(articles, provider.name)
        results.push(processed)
        console.log(`[PIPELINE] Provider ${provider.name} processed: ${processed.itemCount} items, ${processed.dedupeRate.toFixed(1)}% deduped`)
        
        // Track provider success
        await trackEvent({
          event: 'ingest_run',
          payload: {
            provider: provider.name,
            item_count: processed.itemCount,
            dedupe_rate: processed.dedupeRate,
            scheduled
          }
        })
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        const fullErrorMsg = `Provider ${provider.name} failed: ${errorMsg}`
        console.error(`[PIPELINE] ${fullErrorMsg}`)
        allErrors.push(fullErrorMsg)
        
        // Add empty result for failed provider
        results.push({
          provider: provider.name,
          itemCount: 0,
          dedupeRate: 0,
          articles: [],
          errors: [errorMsg]
        })
        
        await trackEvent({
          event: 'provider_error',
          payload: {
            provider: provider.name,
            type: this.classifyError(error),
            error: errorMsg
          }
        })
      }
    }

    // Record ingestion run
    const dbClient = supabaseAdmin || supabase
    if (dbClient) {
      for (const result of results) {
        try {
          await dbClient.from('ingestion_runs').insert({
            provider: result.provider,
            item_count: result.itemCount,
            dedupe_rate: result.dedupeRate,
            scheduled,
            ts: startTime.toISOString()
          })
        } catch (error) {
          console.error('Failed to record ingestion run:', error)
        }
      }
    }

    // Prepare summary
    const providerCounts = results.reduce((acc, result) => {
      acc[result.provider] = result.itemCount
      return acc
    }, {} as Record<string, number>)

    const totalItems = results.reduce((sum, result) => sum + result.itemCount, 0)
    const avgDedupeRate = results.length > 0 
      ? results.reduce((sum, result) => sum + result.dedupeRate, 0) / results.length
      : 0

    console.log(`Ingestion completed: ${totalItems} total items, ${avgDedupeRate.toFixed(1)}% dedupe rate`)

    return {
      providerCounts,
      totalItems,
      dedupeRate: avgDedupeRate,
      lastRunTs: startTime.toISOString(),
      errors: allErrors
    }
  }

  private async processArticles(articles: ProviderArticle[], provider: string): Promise<IngestionResult> {
    const processedArticles: ProviderArticle[] = []
    const errors: string[] = []
    let duplicateCount = 0

    // Use admin client for server-side operations, fallback to regular client or mock
    const dbClient = supabaseAdmin || supabase
    
    if (!dbClient) {
      console.warn('[PIPELINE] No database client configured - using mock storage for development')
      return this.mockProcessArticles(articles, provider)
    }

    // Get company ID mapping
    const { data: companies } = await dbClient
      .from('companies')
      .select('id, canonical_name')
    
    const companyMap = new Map<string, number>()
    companies?.forEach(c => {
      const canonical = c.canonical_name
      companyMap.set(canonical.toLowerCase(), c.id)
      
      // Add alias mappings
      const aliases = COMPANY_ALIASES[canonical] || []
      aliases.forEach(alias => {
        companyMap.set(alias.toLowerCase(), c.id)
      })
    })

    console.log(`[PIPELINE] Processing ${articles.length} articles for provider ${provider}`)
    console.log(`[PIPELINE] Company map has ${companyMap.size} entries`)
    
    for (const article of articles) {
      try {
        // Validate article
        if (!this.isValidArticle(article)) {
          const reason = this.getValidationFailureReason(article)
          errors.push(`Invalid article: ${reason}`)
          console.log(`[PIPELINE] Invalid article: ${reason} - ${article.title?.substring(0, 50)}`)
          
          await trackEvent({
            event: 'article_skipped_invalid_url',
            payload: {
              provider,
              reason,
              title: article.title?.substring(0, 100) || 'unknown'
            }
          })
          continue
        }

        // Normalize and compute url_norm for deduplication
        const urlNorm = this.normalizeUrlForDedup(article.url)
        
        // Get company ID - try multiple lookup strategies
        let companyId = companyMap.get(article.company_slug.toLowerCase())
        console.log(`[PIPELINE] Looking up company: ${article.company_slug} -> ${companyId || 'NOT FOUND'}`)
        
        // If not found, try to find by partial match
        if (!companyId) {
          for (const [key, id] of companyMap.entries()) {
            if (key.includes(article.company_slug.toLowerCase()) || 
                article.company_slug.toLowerCase().includes(key)) {
              companyId = id
              console.log(`[PIPELINE] Found company by partial match: ${key} -> ${id}`)
              break
            }
          }
        }
        
        if (!companyId) {
          errors.push(`Unknown company: ${article.company_slug}`)
          console.log(`[PIPELINE] Unknown company: ${article.company_slug} (available: ${Array.from(companyMap.keys()).join(', ')})`)
          continue
        }

        // Calculate priority
        const priority = this.calculatePriority(article.source_domain)

        // Prepare article data
        const articleData = {
          company_id: companyId,
          title: article.title.trim(),
          url: article.url,
          url_norm: urlNorm,
          source_domain: article.source_domain,
          published_at: article.published_at,
          priority,
          provider,
          raw_json: article.raw_json
        }

        // Upsert article (handle duplicates)
        console.log(`[PIPELINE] Inserting article: ${article.title.substring(0, 50)}... company_id=${companyId}`)
        const { error } = await dbClient
          .from('articles')
          .upsert(articleData, {
            onConflict: 'url_norm',
            ignoreDuplicates: false
          })

        if (error) {
          if (error.message.includes('duplicate') || error.code === '23505') {
            duplicateCount++
            console.log(`[PIPELINE] Duplicate article: ${article.title.substring(0, 50)}`)
          } else {
            errors.push(`Database error for "${article.title}": ${error.message}`)
            console.error(`[PIPELINE] Database error: ${error.message} for article: ${article.title.substring(0, 50)}`)
          }
        } else {
          processedArticles.push(article)
          console.log(`[PIPELINE] Successfully inserted: ${article.title.substring(0, 50)}`)
        }

      } catch (error) {
        errors.push(`Processing error for "${article.title}": ${error}`)
      }
    }

    const dedupeRate = articles.length > 0 ? (duplicateCount / articles.length) * 100 : 0

    return {
      provider,
      itemCount: processedArticles.length,
      dedupeRate,
      articles: processedArticles,
      errors
    }
  }

  private isValidArticle(article: ProviderArticle): boolean {
    return Boolean(
      article.title &&
      article.title.trim().length >= 3 &&
      article.url &&
      this.isValidUrl(article.url) &&
      !article.url.includes('example.com') &&
      article.source_domain &&
      article.published_at
    )
  }

  private getValidationFailureReason(article: ProviderArticle): string {
    if (!article.title || article.title.trim().length < 3) return 'invalid_title'
    if (!article.url || !this.isValidUrl(article.url)) return 'invalid_url'
    if (article.url.includes('example.com')) return 'example_url'
    if (!article.source_domain) return 'missing_domain'
    if (!article.published_at) return 'missing_date'
    return 'unknown'
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  private normalizeUrlForDedup(url: string): string {
    try {
      const parsed = new URL(url)
      
      // Remove tracking parameters
      const cleanParams = new URLSearchParams()
      for (const [key, value] of parsed.searchParams) {
        if (!key.match(/^(utm_|fbclid|gclid|ref|source|CMPID|_ga)/i)) {
          cleanParams.set(key, value)
        }
      }
      
      parsed.search = cleanParams.toString()
      
      // Normalize the URL for deduplication
      return parsed.toString().toLowerCase()
      
    } catch {
      return url.toLowerCase()
    }
  }

  private calculatePriority(domain: string): number {
    const normalizedDomain = domain.replace(/^www\./, '').toLowerCase()
    return DOMAIN_PRIORITIES[normalizedDomain] || DOMAIN_PRIORITIES.default
  }

  private classifyError(error: unknown): string {
    const errorStr = String(error).toLowerCase()
    
    if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
      return 'timeout'
    }
    if (errorStr.includes('rate limit') || errorStr.includes('429')) {
      return 'rate_limit'
    }
    if (errorStr.includes('network') || errorStr.includes('fetch')) {
      return 'network'
    }
    if (errorStr.includes('json') || errorStr.includes('parse')) {
      return 'schema'
    }
    if (errorStr.includes('credits') || errorStr.includes('gateway')) {
      return 'api_credits'
    }
    if (errorStr.includes('supabase')) {
      return 'database'
    }
    
    return 'unknown'
  }
  
  private async mockProcessArticles(articles: ProviderArticle[], provider: string): Promise<IngestionResult> {
    const processedArticles: ProviderArticle[] = []
    const errors: string[] = []
    let duplicateCount = 0
    
    // Create a simple in-memory deduplication
    const seenUrls = new Set<string>()
    
    for (const article of articles) {
      try {
        // Validate article
        if (!this.isValidArticle(article)) {
          const reason = this.getValidationFailureReason(article)
          errors.push(`Invalid article: ${reason}`)
          continue
        }
        
        // Normalize URL for deduplication
        const urlNorm = this.normalizeUrlForDedup(article.url)
        
        if (seenUrls.has(urlNorm)) {
          duplicateCount++
          continue
        }
        
        seenUrls.add(urlNorm)
        processedArticles.push(article)
        
      } catch (error) {
        errors.push(`Processing error for "${article.title}": ${error}`)
      }
    }
    
    const dedupeRate = articles.length > 0 ? (duplicateCount / articles.length) * 100 : 0
    
    console.log(`[PIPELINE-MOCK] Processed ${processedArticles.length} articles, ${duplicateCount} duplicates, ${errors.length} errors`)
    
    return {
      provider,
      itemCount: processedArticles.length,
      dedupeRate,
      articles: processedArticles,
      errors
    }
  }
}
