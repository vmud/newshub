import { supabase } from './supabase'

export interface TelemetryEvent {
  event: string
  user_id?: string
  article_id?: number
  payload?: Record<string, any>
}

export async function trackEvent(eventData: TelemetryEvent) {
  try {
    if (!supabase) {
      console.warn('Supabase not configured, skipping telemetry')
      return
    }

    const { error } = await supabase
      .from('events_frontpage')
      .insert({
        event: eventData.event,
        user_id: eventData.user_id || `anon_${Date.now()}`,
        article_id: eventData.article_id || null,
        payload: eventData.payload || {},
        ts: new Date().toISOString()
      })

    if (error) {
      console.error('Telemetry error:', error)
    }
  } catch (error) {
    console.error('Failed to track event:', error)
  }
}
