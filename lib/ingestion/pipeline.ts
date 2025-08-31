import { supabase } from '@/lib/supabase'
import { PerplexityProvider } from '@/lib/providers/perplexity'
import { GDELTProvider } from '@/lib/providers/gdelt'
import { NewsProvider, ProviderArticle, IngestionResult, IngestionRunSummary } from '@/lib/providers/types'
import { trackEvent } from '@/lib/telemetry'

// Company aliases from config
const COMPANY_ALIASES: Record<string, string[]> = {
  'qualcomm': ['Qualcomm', 'Snapdragon'],
  'google': ['Google', 'Android', 'Pixel'],
  'samsung': ['Samsung', 'Galaxy'],
  'whirlpool': ['Whirlpool', 'KitchenAid', 'Maytag'],
  'bestbuy': ['Best Buy', 'Geek Squad']
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
    const enabledProviders = (process.env.NEWS_PROVIDERS || 'perplexity,gdelt').split(',')
    
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

    console.log(`Starting ingestion run (scheduled: ${scheduled})`)

    // Get all company aliases
    const allAliases = Object.values(COMPANY_ALIASES).flat()
    const sinceDt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days for better coverage

    // Fetch from each provider
    for (const provider of this.providers) {
      try {
        console.log(`Fetching from provider: ${provider.name}`)
        const articles = await provider.fetch(allAliases, sinceDt)
        
        const processed = await this.processArticles(articles, provider.name)
        results.push(processed)
        
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
        const errorMsg = `Provider ${provider.name} failed: ${error}`
        console.error(errorMsg)
        allErrors.push(errorMsg)
        
        await trackEvent({
          event: 'provider_error',
          payload: {
            provider: provider.name,
            type: this.classifyError(error),
            error: String(error)
          }
        })
      }
    }

    // Record ingestion run
    if (supabase) {
      for (const result of results) {
        try {
          await supabase.from('ingestion_runs').insert({
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

    if (!supabase) {
      throw new Error('Supabase client not configured')
    }

    // Get company ID mapping
    const { data: companies } = await supabase
      .from('companies')
      .select('id, canonical_name')
    
    const companyMap = new Map<string, string>()
    companies?.forEach(c => {
      const canonical = c.canonical_name.toLowerCase()
      companyMap.set(canonical, c.id)
      
      // Add alias mappings
      const aliases = COMPANY_ALIASES[canonical] || []
      aliases.forEach(alias => {
        companyMap.set(alias.toLowerCase(), c.id)
      })
    })

    for (const article of articles) {
      try {
        // Validate article
        if (!this.isValidArticle(article)) {
          const reason = this.getValidationFailureReason(article)
          errors.push(`Invalid article: ${reason}`)
          
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
        
        // Get company ID
        const companyId = companyMap.get(article.company_slug.toLowerCase())
        if (!companyId) {
          errors.push(`Unknown company: ${article.company_slug}`)
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
        const { error } = await supabase
          .from('articles')
          .upsert(articleData, {
            onConflict: 'url_norm',
            ignoreDuplicates: false
          })

        if (error) {
          if (error.message.includes('duplicate') || error.code === '23505') {
            duplicateCount++
          } else {
            errors.push(`Database error for "${article.title}": ${error.message}`)
          }
        } else {
          processedArticles.push(article)
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
    
    return 'unknown'
  }
}
