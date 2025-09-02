import { NewsProvider, ProviderArticle } from './types'
import { generateWithGateway } from '@/lib/ai-gateway'

export class AINewsProvider implements NewsProvider {
  name = 'ai-news'
  
  async fetch(companyAliases: string[], sinceDt: Date): Promise<ProviderArticle[]> {
    const maxRequestsPerRun = parseInt(process.env.AI_MAX_REQUESTS_PER_RUN || '8')
    const articles: ProviderArticle[] = []
    
    // Batch companies to stay within request limits
    const companiesPerRequest = Math.max(1, Math.floor(companyAliases.length / maxRequestsPerRun))
    
    for (let i = 0; i < companyAliases.length; i += companiesPerRequest) {
      const batch = companyAliases.slice(i, i + companiesPerRequest)
      try {
        const batchArticles = await this.fetchBatch(batch, sinceDt)
        articles.push(...batchArticles)
      } catch (error) {
        console.error(`AI News batch error for ${batch.join(', ')}:`, error)
        // Continue with other batches
      }
    }
    
    return articles
  }

  private async fetchBatch(companies: string[], sinceDt: Date): Promise<ProviderArticle[]> {
    const companiesStr = companies.join(' OR ')
    const sinceStr = sinceDt.toISOString().split('T')[0] // YYYY-MM-DD format
    
    const prompt = `Find recent news articles published since ${sinceStr} about these companies: ${companiesStr}. 

Return a JSON array with each article having these exact fields:
- title: string (article headline)
- url: string (full article URL, must be real and accessible)
- source_domain: string (domain name like "techcrunch.com")
- published_at: string (ISO 8601 format like "2024-01-15T10:30:00Z")
- company_mentioned: string (which company from the list this article is about)

Focus on business, technology, and product news. Only return real, verifiable articles with working URLs. Return maximum 10 articles per batch.

Example format:
[
  {
    "title": "Company X announces new product",
    "url": "https://techcrunch.com/2024/01/15/company-x-announces-new-product",
    "source_domain": "techcrunch.com",
    "published_at": "2024-01-15T10:30:00Z",
    "company_mentioned": "Company X"
  }
]`
    
    try {
      const result = await generateWithGateway(
        prompt,
        'news',
        {
          maxTokens: 2000,
          temperature: 0.1,
          tags: {
            batch_size: companies.length.toString(),
            companies: companies.join(',')
          }
        }
      )
      
      const content = result.text
      const articles = this.parseArticlesFromContent(content, companies)
      
      return articles.map(article => ({
        ...article,
        provider: this.name,
        raw_json: { 
          ai_response: result,
          query: prompt,
          companies_searched: companies
        }
      }))
      
    } catch (error) {
      throw new Error(`AI News API error: ${error}`)
    }
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
          if (item.title && item.url && item.source_domain && item.company_mentioned) {
            // Validate the article
            if (this.isValidArticle(item)) {
              articles.push({
                title: item.title.trim(),
                url: this.normalizeUrl(item.url),
                source_domain: this.extractDomain(item.url),
                published_at: this.normalizeDate(item.published_at || new Date().toISOString()),
                company_slug: item.company_mentioned.toLowerCase()
              })
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse JSON from AI response, falling back to text parsing:', error)
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

  private isValidArticle(article: Record<string, unknown>): boolean {
    return (
      typeof article.title === 'string' &&
      article.title.trim().length >= 3 &&
      typeof article.url === 'string' &&
      this.isValidUrl(article.url) &&
      !article.url.includes('example.com') &&
      typeof article.source_domain === 'string' &&
      typeof article.company_mentioned === 'string'
    )
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
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
