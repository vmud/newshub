'use client'

import { useState, useEffect } from 'react'
import { getTop10Articles, Article } from '@/lib/articles'
import { FrontPage } from '@/components/FrontPage'

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    async function fetchArticles() {
      try {
        const data = await getTop10Articles()
        setArticles(data)
      } catch (error) {
        console.error('Failed to fetch articles:', error)
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()
  }, [])
  
  return (
    <FrontPage 
      articles={articles} 
      isLoading={isLoading} 
      hasError={hasError} 
    />
  )
}
