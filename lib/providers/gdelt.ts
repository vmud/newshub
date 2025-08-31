import { NewsProvider, ProviderArticle } from './types'

export class GDELTProvider implements NewsProvider {
  name = 'gdelt'
  private baseUrl = 'https://api.gdeltproject.org/api/v2'

  async fetch(companyAliases: string[], sinceDt: Date): Promise<ProviderArticle[]> {
    const articles: ProviderArticle[] = []
    const maxLinksPerRun = parseInt(process.env.NEWS_MAX_LINKS_PER_PROVIDER_PER_RUN || '25')
    
    // Search for each company individually to get better results
    for (const company of companyAliases) {
      try {
        const companyArticles = await this.fetchForCompany(company, sinceDt)
        articles.push(...companyArticles.slice(0, Math.floor(maxLinksPerRun / companyAliases.length)))
      } catch (error) {
        console.error(`GDELT error for ${company}:`, error)
        // Continue with other companies
      }
    }
    
    return articles.slice(0, maxLinksPerRun)
  }

  private async fetchForCompany(company: string, sinceDt: Date): Promise<ProviderArticle[]> {
    const startDate = this.formatGDELTDate(sinceDt)
    const endDate = this.formatGDELTDate(new Date())
    
    // GDELT query parameters
    const params = new URLSearchParams({
      query: `"${company}"`,
      mode: 'artlist',
      format: 'json',
      sort: 'DateDesc',
      maxrecords: '50',
      startdatetime: startDate,
      enddatetime: endDate,
      theme: 'GENERAL_BUSINESS,ECON_STOCKMARKET,SCI_TECHNOLOGY'
    })

    const url = `${this.baseUrl}/doc/doc?${params}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': process.env.EDGAR_USER_AGENT || 'NewsHub/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`GDELT API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.articles || !Array.isArray(data.articles)) {
      return []
    }

    return data.articles
      .filter((article: any) => this.isValidArticle(article))
      .map((article: any) => this.transformArticle(article, company))
  }

  private isValidArticle(article: any): boolean {
    return (
      article.title &&
      article.url &&
      article.domain &&
      article.seendate &&
      !article.url.includes('example.com') &&
      this.isValidUrl(article.url)
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

  private transformArticle(article: any, company: string): ProviderArticle {
    return {
      title: this.cleanTitle(article.title),
      url: this.normalizeUrl(article.url),
      source_domain: this.extractDomain(article.url),
      published_at: this.parseGDELTDate(article.seendate),
      company_slug: company.toLowerCase(),
      provider: this.name,
      raw_json: {
        gdelt_article: article,
        search_company: company
      }
    }
  }

  private cleanTitle(title: string): string {
    // Remove common GDELT artifacts and clean up
    return title
      .replace(/\s+/g, ' ')
      .replace(/^[|\-\s]+/, '')
      .replace(/[|\-\s]+$/, '')
      .trim()
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      // Remove tracking parameters
      const cleanParams = new URLSearchParams()
      for (const [key, value] of parsed.searchParams) {
        if (!key.match(/^(utm_|fbclid|gclid|ref|source|CMPID)/i)) {
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

  private formatGDELTDate(date: Date): string {
    // GDELT expects YYYYMMDDHHMMSS format
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`
  }

  private parseGDELTDate(gdeltDate: string): string {
    try {
      // GDELT date format: YYYYMMDDHHMMSS
      const year = parseInt(gdeltDate.substring(0, 4))
      const month = parseInt(gdeltDate.substring(4, 6)) - 1 // JS months are 0-indexed
      const day = parseInt(gdeltDate.substring(6, 8))
      const hours = parseInt(gdeltDate.substring(8, 10) || '0')
      const minutes = parseInt(gdeltDate.substring(10, 12) || '0')
      const seconds = parseInt(gdeltDate.substring(12, 14) || '0')
      
      return new Date(year, month, day, hours, minutes, seconds).toISOString()
    } catch {
      return new Date().toISOString()
    }
  }
}
