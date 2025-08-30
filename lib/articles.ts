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

export async function getTop10Articles(): Promise<Article[]> {
  try {
    if (!supabase) {
      console.warn('Supabase not configured, returning empty articles')
      return []
    }

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
        companies!inner(canonical_name),
        summaries(bullets)
      `)
      .order('priority', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching articles:', error)
      return []
    }

    return articles?.map((article: any, index: number) => ({
      id: article.id,
      company_canonical: article.companies.canonical_name,
      title: article.title,
      url: article.url,
      source_domain: article.source_domain,
      published_at: article.published_at,
      provider: article.provider,
      priority: article.priority,
      summary_bullets: article.summaries?.[0]?.bullets || null,
      snacks_eligible: index < 3 // Top-3 are eligible for Snacks
    })) || []
  } catch (error) {
    console.error('Failed to fetch articles:', error)
    return []
  }
}
