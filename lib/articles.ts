import { supabase } from './supabase'

export interface Article {
  id: number
  company_canonical: string
  title: string
  url: string
  source_domain: string
  published_at: string
  provider: string
  priority: number
  summary_bullets?: string[]
  snacks_eligible: boolean
}



function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isValidTitle(title: string): boolean {
  return Boolean(title && title.trim().length >= 3)
}

function logArticleSkipped(articleId: number, provider: string, reason: string) {
  console.warn(`Article skipped: ID ${articleId}, Provider ${provider}, Reason: ${reason}`)
  // TODO: Send to Sentry when available
}

export async function getTop10Articles(): Promise<Article[]> {
  try {
    if (!supabase) {
      console.warn('Supabase not configured, returning empty articles')
      return []
    }

    // Fetch more than 10 to account for filtering
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        id,
        title,
        url,
        source_domain,
        published_at,
        provider,
        priority,
        snacks_eligible,
        companies!inner(canonical_name),
        summaries(bullets)
      `)
      .order('priority', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching articles:', error)
      return []
    }

    const validArticles = articles?.filter((article) => {
      // Filter out invalid articles
      if (!isValidTitle(article.title)) {
        logArticleSkipped(article.id, article.provider, 'invalid_title')
        return false
      }
      
      if (!article.url || !isValidUrl(article.url)) {
        logArticleSkipped(article.id, article.provider, 'invalid_url')
        return false
      }
      
      if (article.url.includes('example.com')) {
        logArticleSkipped(article.id, article.provider, 'example_url_placeholder')
        return false
      }
      
      return true
    }) || []

    return validArticles.slice(0, 10).map((article, index) => ({
      id: article.id,
      company_canonical: article.companies[0]?.canonical_name || 'Unknown',
      title: article.title,
      url: article.url,
      source_domain: article.source_domain,
      published_at: article.published_at,
      provider: article.provider,
      priority: article.priority,
      summary_bullets: article.summaries?.[0]?.bullets || null,
      snacks_eligible: index < 3 // Top-3 are eligible for Snacks
    }))
  } catch (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }
}
