import { generateWithGateway } from '@/lib/ai-gateway'
import { trackEvent } from '@/lib/telemetry'

export interface SnacksSummary {
  bullets: string[]
  generated_at: string
  model_used: string
  cost_estimate: number
}

export async function generateSnacksSummary(
  articleTitle: string,
  articleUrl: string,
  companyName: string
): Promise<SnacksSummary> {
  const prompt = `Summarize this news article in 3 bullet points for a "Snacks" style brief:

Title: ${articleTitle}
Company: ${companyName}
URL: ${articleUrl}

Requirements:
- Each bullet should be 1-2 sentences max
- Focus on the "why it matters" angle
- Use conversational, engaging tone
- No buzzwords or jargon
- Maximum 200 characters per bullet
- Third bullet should explain "why it matters"

Return as a JSON array of strings:
["bullet 1", "bullet 2", "bullet 3"]`

  try {
    const result = await generateWithGateway(
      prompt,
      'snacks',
      {
        maxTokens: 500,
        temperature: 0.3,
        tags: {
          company: companyName.toLowerCase(),
          article_type: 'news_summary'
        }
      }
    )
    
    // Parse the response
    let bullets: string[] = []
    try {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        bullets = JSON.parse(jsonMatch[0])
      } else {
        // Fallback parsing
        bullets = result.text
          .split('\n')
          .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
          .map(line => line.replace(/^[•\-]\s*/, '').trim())
          .slice(0, 3)
      }
    } catch {
      // Final fallback
      bullets = [
        `${companyName} made news with: ${articleTitle}`,
        'This development could impact the industry.',
        'Why it matters: Stay tuned for updates.'
      ]
    }
    
    // Validate bullets
    if (bullets.length === 0) {
      bullets = [
        `${companyName} made news with: ${articleTitle}`,
        'This development could impact the industry.',
        'Why it matters: Stay tuned for updates.'
      ]
    }
    
    // Ensure we have exactly 3 bullets
    while (bullets.length < 3) {
      bullets.push('Additional details available in the full article.')
    }
    bullets = bullets.slice(0, 3)
    
    // Track the generation
    await trackEvent({
      event: 'summary_generated',
      payload: {
        company: companyName,
        article_title: articleTitle.substring(0, 100),
        bullets_count: bullets.length,
        model_used: 'ai-gateway',
        cost_estimate: 0.05 // Rough estimate
      }
    })
    
    return {
      bullets,
      generated_at: new Date().toISOString(),
      model_used: 'ai-gateway',
      cost_estimate: 0.05
    }
    
  } catch (error) {
    console.error('Snacks generation failed:', error)
    
    // Track the failure
    await trackEvent({
      event: 'snacks_lint_failed',
      payload: {
        company: companyName,
        article_title: articleTitle.substring(0, 100),
        error: String(error)
      }
    })
    
    // Return fallback summary
    return {
      bullets: [
        `${companyName} made news with: ${articleTitle}`,
        'This development could impact the industry.',
        'Why it matters: Stay tuned for updates.'
      ],
      generated_at: new Date().toISOString(),
      model_used: 'fallback',
      cost_estimate: 0
    }
  }
}
