import { Suspense } from 'react'
import { getTop10Articles } from '@/lib/articles'
import { FrontPage } from '@/components/FrontPage'

export default async function HomePage() {
  const articles = await getTop10Articles()
  
  return (
    <Suspense fallback={<FrontPage articles={[]} isLoading={true} />}>
      <FrontPage articles={articles} />
    </Suspense>
  )
}
