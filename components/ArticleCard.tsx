'use client'

import { useState } from 'react'
import { Article } from '@/lib/articles'
import { trackEvent } from '@/lib/telemetry'
import { ExternalLink, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react'

interface ArticleCardProps {
  article: Article
  rank: number
}

export function ArticleCard({ article, rank }: ArticleCardProps) {
  const [showSnacks, setShowSnacks] = useState(true)
  const [hasLintError, setHasLintError] = useState(false)

  const handleHeadlineClick = () => {
    trackEvent({
      event: 'headline_clicked',
      article_id: article.id,
      payload: { position: rank, source: 'homepage' }
    })
  }

  const getTimeAgo = (publishedAt: string) => {
    const now = new Date()
    const published = new Date(publishedAt)
    const diffHours = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'just now'
    if (diffHours === 1) return '1h ago'
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return '1d ago'
    return `${diffDays}d ago`
  }

  const renderContent = () => {
    if (article.snacks_eligible && showSnacks && article.summary_bullets) {
      if (hasLintError) {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <AlertTriangle size={16} />
              <span className="bg-orange-100 px-2 py-1 rounded text-xs">style retry</span>
            </div>
            <p className="text-gray-600 line-clamp-3">{article.title}</p>
          </div>
        )
      }
      
      return (
        <div className="space-y-2">
          {article.summary_bullets.map((bullet: string, index: number) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">•</span>
              <p className="text-gray-700 text-sm">{bullet}</p>
            </div>
          ))}
        </div>
      )
    }
    
    return <p className="text-gray-600 line-clamp-3">{article.title}</p>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
            {article.company_canonical}
          </span>
          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
            {article.provider}
          </span>
        </div>
        <span className="text-gray-500 text-xs">{getTimeAgo(article.published_at)}</span>
      </div>

      {article.snacks_eligible && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowSnacks(!showSnacks)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          >
            {showSnacks ? <ToggleRight className="text-blue-500" size={16} /> : <ToggleLeft size={16} />}
            <span>{showSnacks ? 'Snacks' : 'Raw'}</span>
          </button>
        </div>
      )}

      <div className="mb-3">
        {renderContent()}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-xs">{article.source_domain}</span>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleHeadlineClick}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
        >
          Read more
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  )
}
