import { NewsProvider, ProviderArticle } from './types'

export class PerplexityProvider implements NewsProvider {
  name = 'perplexity'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async fetch(companyAliases: string[], sinceDt: Date): Promise<ProviderArticle[]> {
    const articles: ProviderArticle[] = []
    const maxRequestsPerRun = parseInt(process.env.PPLX_MAX_REQUESTS_PER_RUN || '8')
    
    // Batch companies to stay within request limits
    const companiesPerRequest = Math.max(1, Math.floor(companyAliases.length / maxRequestsPerRun))
    
    for (let i = 0; i < companyAliases.length; i += companiesPerRequest) {
      const batch = companyAliases.slice(i, i + companiesPerRequest)
      try {
        const batchArticles = await this.fetchBatch(batch, sinceDt)
        articles.push(...batchArticles)
      } catch (error) {
        console.error(`Perplexity batch error for ${batch.join(', ')}:`, error)
        // Continue with other batches
      }
    }
    
    return articles
  }

  private async fetchBatch(companies: string[], sinceDt: Date): Promise<ProviderArticle[]> {
    const companiesStr = companies.join(' OR ')
    const sinceStr = sinceDt.toISOString().split('T')[0] // YYYY-MM-DD format
    
    const query = `Latest news articles about (${companiesStr}) since ${sinceStr}. Include article title, URL, source domain, and publication date.`
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a news aggregator. Return structured data about recent news articles in JSON format. Each article should have: title, url, source_domain, published_at (ISO format), company_mentioned. Only return real, verifiable articles with working URLs.'
          },
          {
            role: 'user', 
            content: query
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        return_related_questions: false,
        search_domain_filter: ['techcrunch.com', 'theverge.com', 'engadget.com', 'androidcentral.com', 'reuters.com', 'bloomberg.com', 'cnbc.com', 'wsj.com']
      })
    })

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return []
    }

    // Parse the structured response
    const articles = this.parseArticlesFromContent(content, companies)
    
    return articles.map(article => ({
      ...article,
      provider: this.name,
      raw_json: { perplexity_response: data, query }
    }))
  }

  private parseArticlesFromContent(content: string, companies: string[]): Omit<ProviderArticle, 'provider' | 'raw_json'>[] {
    const articles: Omit<ProviderArticle, 'provider' | 'raw_json'>[] = []
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/) || content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const articlesArray = Array.isArray(parsed) ? parsed : [parsed]
        
        for (const item of articlesArray) {
          if (item.title && item.url && item.source_domain) {
            // Match company to canonical name
            const matchedCompany = this.matchCompanyFromTitle(item.title, companies)
            if (matchedCompany) {
              articles.push({
                title: item.title.trim(),
                url: this.normalizeUrl(item.url),
                source_domain: this.extractDomain(item.url),
                published_at: this.normalizeDate(item.published_at || new Date().toISOString()),
                company_slug: matchedCompany.toLowerCase()
              })
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse JSON from Perplexity response, falling back to text parsing')
      // Fallback: parse from natural language response
      return this.parseFromNaturalLanguage(content, companies)
    }
    
    return articles
  }

  private parseFromNaturalLanguage(content: string, companies: string[]): Omit<ProviderArticle, 'provider' | 'raw_json'>[] {
    // Simple regex-based parsing for common patterns
    const urlPattern = /https?:\/\/[^\s\)]+/g
    const urls = content.match(urlPattern) || []
    
    return urls.slice(0, 5).map(url => {
      const domain = this.extractDomain(url)
      const matchedCompany = companies.find(c => 
        content.toLowerCase().includes(c.toLowerCase())
      ) || companies[0]
      
      return {
        title: `Recent ${matchedCompany} news from ${domain}`,
        url: this.normalizeUrl(url),
        source_domain: domain,
        published_at: new Date().toISOString(),
        company_slug: matchedCompany.toLowerCase()
      }
    })
  }

  private matchCompanyFromTitle(title: string, companies: string[]): string | null {
    const titleLower = title.toLowerCase()
    
    for (const company of companies) {
      const companyWords = company.toLowerCase().split(/\s+/)
      const hasAllWords = companyWords.every(word => 
        titleLower.includes(word)
      )
      if (hasAllWords) {
        return company
      }
    }
    
    return null
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      // Remove tracking parameters
      const cleanParams = new URLSearchParams()
      for (const [key, value] of parsed.searchParams) {
        if (!key.match(/^(utm_|fbclid|gclid|ref|source)/i)) {
          cleanParams.set(key, value)
        }
      }
      parsed.search = cleanParams.toString()
      return parsed.toString()
    } catch {
      return url
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return 'unknown.com'
    }
  }

  private normalizeDate(dateStr: string): string {
    try {
      return new Date(dateStr).toISOString()
    } catch {
      return new Date().toISOString()
    }
  }
}
