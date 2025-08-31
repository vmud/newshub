import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

// Server-side client with service role for admin access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ProviderScorecard {
  provider: string
  runs_24h: number
  last_run_ts: string | null
  items_ingested_24h: number
  dedupe_avg_pct_24h: number
  errors_24h: number
  success_rate_pct_24h: number
  last_success_ts: string | null
}

interface CompanyCoverage {
  company: string
  items_24h: number
  last_item_ts: string | null
  distinct_sources: number
}

interface SnacksCost {
  summaries_24h: number
  total_cost_usd_24h: number
  avg_latency_ms_24h: number
  p95_latency_ms_24h: number
}

async function getProviderScorecard(): Promise<ProviderScorecard[]> {
  const { data, error } = await supabaseAdmin
    .from('provider_scorecard_24h')
    .select('*')
    .order('provider')
  
  if (error) {
    console.error('Error fetching provider scorecard:', error)
    return []
  }
  
  return data || []
}

async function getCompanyCoverage(): Promise<CompanyCoverage[]> {
  const { data, error } = await supabaseAdmin
    .from('company_coverage_24h')
    .select('*')
    .order('company')
  
  if (error) {
    console.error('Error fetching company coverage:', error)
    return []
  }
  
  return data || []
}

async function getSnacksCost(): Promise<SnacksCost[]> {
  const { data, error } = await supabaseAdmin
    .from('snacks_cost_24h')
    .select('*')
  
  if (error) {
    console.error('Error fetching snacks cost:', error)
    return []
  }
  
  return data || []
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Never'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return 'Invalid'
  }
}

export default async function AdminScorecardPage() {
  // Simple admin check - in a real app, this would be more robust
  const isAdmin = process.env.NODE_ENV === 'development' || 
                  process.env.VERCEL_ENV === 'preview'
  
  if (!isAdmin) {
    notFound()
  }

  const [providerData, companyData, snacksData] = await Promise.all([
    getProviderScorecard(),
    getCompanyCoverage(), 
    getSnacksCost()
  ])

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Scorecard</h1>
        <p className="text-gray-600">24-hour provider health and system metrics</p>
      </div>

      {/* Provider Scorecard Table */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Provider Scorecard (24h)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Provider</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Runs</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Last Run</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Items Ingested</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Dedupe Avg %</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Errors</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Success Rate %</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Last Success</th>
              </tr>
            </thead>
            <tbody>
              {providerData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    No ingestion runs in the last 24 hours
                  </td>
                </tr>
              ) : (
                providerData.map((row) => (
                  <tr key={row.provider} className="border-b border-gray-200">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.provider}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.runs_24h}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatTimestamp(row.last_run_ts)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.items_ingested_24h}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.dedupe_avg_pct_24h}%</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.errors_24h}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.success_rate_pct_24h}%</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatTimestamp(row.last_success_ts)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company Coverage Table */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Coverage (24h)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Company</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Items</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Last Item</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Distinct Sources</th>
              </tr>
            </thead>
            <tbody>
              {companyData.map((row) => (
                <tr key={row.company} className="border-b border-gray-200">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.company}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.items_24h}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatTimestamp(row.last_item_ts)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.distinct_sources}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snacks Cost Table */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Snacks Cost (24h)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Summaries</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Total Cost (USD)</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">Avg Latency (ms)</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b">P95 Latency (ms)</th>
              </tr>
            </thead>
            <tbody>
              {snacksData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No snacks summaries in the last 24 hours
                  </td>
                </tr>
              ) : (
                snacksData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-4 py-3 text-sm text-gray-700">{row.summaries_24h}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">${row.total_cost_usd_24h}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.avg_latency_ms_24h}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.p95_latency_ms_24h}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-8">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  )
}
