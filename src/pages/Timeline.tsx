import { useCallback } from 'react'
import { MessagesSquare } from 'lucide-react'
import { Composer } from '../components/Composer'
import { PostCard } from '../components/PostCard'
import { EmptyState, ErrorNote, LoadingRows, PageHeader } from '../components/Ui'
import { fetchFeed } from '../lib/api'
import { useAuth } from '../lib/auth'
import { greeting } from '../lib/format'
import { useAsyncData } from '../lib/hooks'

export function TimelinePage() {
  const { profile } = useAuth()
  const { data, loading, error, reload, setData } = useAsyncData(() => fetchFeed(), [])

  const handleDeleted = useCallback(
    (postId: string) => {
      if (!data) return
      setData(data.filter((post) => post.id !== postId))
    },
    [data, setData],
  )

  return (
    <>
      <PageHeader
        eyebrow="Timeline"
        title={greeting(profile?.display_name ?? 'friend')}
        subtitle="Everything the circle is talking about right now."
      />

      <Composer onPosted={() => reload()} />

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <LoadingRows />
      ) : data && data.length > 0 ? (
        <div className="stagger space-y-3">
          {data.map((post) => (
            <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
          ))}
        </div>
      ) : !error ? (
        <EmptyState
          icon={<MessagesSquare className="size-5" />}
          title="The timeline is quiet"
          description="Start the first thread: a question, a plan, a photo from last weekend — whatever you want the circle to see."
        />
      ) : null}
    </>
  )
}
