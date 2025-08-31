export interface ProviderArticle {
  title: string
  url: string
  source_domain: string
  published_at: string // ISO string
  company_slug: string
  provider: string
  raw_json: any
}

export interface NewsProvider {
  name: string
  fetch(companyAliases: string[], sinceDt: Date): Promise<ProviderArticle[]>
}

export interface IngestionResult {
  provider: string
  itemCount: number
  dedupeRate: number
  articles: ProviderArticle[]
  errors: string[]
}

export interface IngestionRunSummary {
  providerCounts: Record<string, number>
  totalItems: number
  dedupeRate: number
  lastRunTs: string
  errors: string[]
}
