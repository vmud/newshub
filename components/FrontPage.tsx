'use client'

import { useEffect } from 'react'
import { Article } from '@/lib/articles'
import { ArticleCard } from './ArticleCard'
import { AdminPanel } from './AdminPanel'
import { trackEvent } from '@/lib/telemetry'
import { RefreshCw } from 'lucide-react'

interface FrontPageProps {
  articles: Article[]
  isLoading?: boolean
  hasError?: boolean
}

export function FrontPage({ articles, isLoading = false, hasError = false }: FrontPageProps) {
  useEffect(() => {
    if (!isLoading) {
      trackEvent({
        event: 'frontpage_viewed',
        payload: { 
          viewport: typeof window !== 'undefined' ? 'desktop' : 'server',
          load_time_ms: performance.now(),
          articles_count: articles.length
        }
      })
    }
  }, [isLoading, articles.length])

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3"></div>
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="animate-pulse">
                <div className="flex gap-2 mb-3">
                  <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NewsHub</h1>
          <p className="text-gray-600">Your daily brief on the companies that matter</p>
        </header>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-2">Cached from last run</p>
          <p className="text-gray-500 text-sm">Quiet newsroom. We'll refresh at 7a/12p/5p ET.</p>
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NewsHub</h1>
          <p className="text-gray-600">Your daily brief on the companies that matter</p>
        </header>
        <div className="text-center py-12">
          <RefreshCw className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">Quiet newsroom. We'll refresh at 7a/12p/5p ET.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">NewsHub</h1>
        <p className="text-gray-600">Your daily brief on the companies that matter</p>
      </header>

      <AdminPanel />
      
      <div className="grid gap-4">
        {articles.map((article, index) => (
          <ArticleCard 
            key={article.id} 
            article={article} 
            rank={index + 1}
          />
        ))}
      </div>
      
      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>Next refresh: 7a/12p/5p ET</p>
      </footer>
    </div>
  )
}
