'use client'

import { useState } from 'react'
import { RefreshCw, Activity, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react'
import Link from 'next/link'

interface IngestionStatus {
  success: boolean
  providerCounts: Record<string, number>
  totalItems: number
  dedupeRate: number
  lastRunTs: string
  errors: string[]
}

export function AdminPanel() {
  const [isIngesting, setIsIngesting] = useState(false)
  const [lastStatus, setLastStatus] = useState<IngestionStatus | null>(null)

  const handleIngestNow = async () => {
    setIsIngesting(true)
    try {
      const response = await fetch('/api/ingest-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const result = await response.json()
      setLastStatus(result)
      
      if (result.success) {
        // Refresh the page to show new articles
        window.location.reload()
      }
    } catch (error) {
      console.error('Ingestion failed:', error)
      setLastStatus({
        success: false,
        providerCounts: {},
        totalItems: 0,
        dedupeRate: 0,
        lastRunTs: new Date().toISOString(),
        errors: [String(error)]
      })
    } finally {
      setIsIngesting(false)
    }
  }

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString()
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className="bg-gray-100 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Activity size={16} />
          Admin Panel
        </h3>
        
        <div className="flex items-center gap-2">
          <Link
            href="/admin/scorecard"
            className="flex items-center gap-2 px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            <BarChart3 size={14} />
            Scorecard
          </Link>
          
          <button
            onClick={handleIngestNow}
            disabled={isIngesting}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={isIngesting ? 'animate-spin' : ''} />
            {isIngesting ? 'Ingesting...' : 'Ingest now'}
          </button>
        </div>
      </div>

      {lastStatus && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {lastStatus.success ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : (
              <AlertCircle size={14} className="text-red-500" />
            )}
            <span className={lastStatus.success ? 'text-green-700' : 'text-red-700'}>
              Last run: {formatTime(lastStatus.lastRunTs)} 
              {lastStatus.success 
                ? ` (${lastStatus.totalItems} items, ${lastStatus.dedupeRate.toFixed(1)}% dedupe)`
                : ' (Failed)'
              }
            </span>
          </div>

          {lastStatus.success && Object.keys(lastStatus.providerCounts).length > 0 && (
            <div className="text-xs text-gray-600">
              Providers: {Object.entries(lastStatus.providerCounts)
                .map(([provider, count]) => `${provider}: ${count}`)
                .join(', ')}
            </div>
          )}

          {lastStatus.errors.length > 0 && (
            <div className="text-xs text-red-600">
              Errors: {lastStatus.errors.slice(0, 2).join('; ')}
              {lastStatus.errors.length > 2 && '...'}
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 mt-2">
        Cron runs: 7a/12p/5p ET daily
      </div>
    </div>
  )
}
