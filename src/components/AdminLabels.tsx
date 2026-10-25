import { useMemo, useState } from 'react'
import { Pin, Plus, Tag, Trash2 } from 'lucide-react'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  fetchLabelablePosts,
  setPostCategory,
  setPostPinned,
  updateCategory,
} from '../lib/api'
import { accent, categoryCount, useCategories } from '../lib/categories'
import { cn } from '../lib/cn'
import { relativeTime } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { Category, CategoryAccent, Post } from '../lib/types'
import { EmptyState, ErrorNote, Spinner } from './Ui'
import { Modal } from './Modal'
import { useToast } from './Toast'

const ACCENT_NAMES: CategoryAccent[] = ['blue', 'violet', 'green', 'amber', 'rose', 'slate']

function AccentPicker({
  value,
  onChange,
}: {
  value: CategoryAccent
  onChange: (next: CategoryAccent) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {ACCENT_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          aria-pressed={value === name}
          onClick={() => onChange(name)}
          className={cn(
            'size-5 rounded-full transition',
            accent(name).dot,
            value === name ? 'ring-2 ring-ink/25 ring-offset-2' : 'opacity-45 hover:opacity-90',
          )}
        />
      ))}
    </div>
  )
}

function CategoryRow({
  category,
  onChanged,
  onDelete,
}: {
  category: Category
  onChanged: () => void
  onDelete: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(category.name)
  const [accentName, setAccentName] = useState<CategoryAccent>(category.accent)
  const [saving, setSaving] = useState(false)

  async function persist(patch: { name?: string; accent?: CategoryAccent }) {
    setSaving(true)
    try {
      await updateCategory(category.id, patch)
      onChanged()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the label.', 'error')
      setName(category.name)
      setAccentName(category.accent)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-hair/70 px-4 py-2.5 last:border-0">
      <span className={cn('size-2.5 shrink-0 rounded-full', accent(accentName).dot)} />
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          const next = name.trim()
          if (!next) {
            setName(category.name)
            return
          }
          if (next !== category.name) void persist({ name: next })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        maxLength={32}
        aria-label={`Label name for ${category.name}`}
        className="field !w-[170px] !py-1.5 !text-[12.5px]"
      />
      <span className="text-[10.5px] text-faint">/{category.slug}</span>
      <span className="rounded-full bg-[#f2f4f8] px-2 py-0.5 text-[10.5px] font-semibold text-muted">
        {categoryCount(category)} {categoryCount(category) === 1 ? 'post' : 'posts'}
      </span>
      <div className="ml-auto flex items-center gap-3">
        <AccentPicker
          value={accentName}
          onChange={(next) => {
            setAccentName(next)
            void persist({ accent: next })
          }}
        />
        {saving ? <Spinner className="text-muted" /> : null}
        <button
          type="button"
          onClick={onDelete}
          className="grid size-7 place-items-center rounded-full text-faint transition hover:bg-[#fff1f0] hover:text-danger"
          aria-label={`Delete ${category.name}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function AdminLabels() {
  const toast = useToast()
  const { reload: reloadSidebar } = useCategories()
  const categories = useAsyncData<Category[]>(() => fetchCategories(), [])
  const posts = useAsyncData<Post[]>(() => fetchLabelablePosts(), [])

  const [name, setName] = useState('')
  const [accentName, setAccentName] = useState<CategoryAccent>('blue')
  const [creating, setCreating] = useState(false)
  const [busyPost, setBusyPost] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)

  const list = categories.data ?? []

  function refreshAll() {
    categories.reload()
    posts.reload()
    void reloadSidebar()
  }

  async function addLabel() {
    const clean = name.trim()
    if (!clean) return
    setCreating(true)
    try {
      await createCategory({ name: clean, accent: accentName })
      setName('')
      toast(`“${clean}” is ready.`, 'success')
      refreshAll()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create the label.', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function togglePin(post: Post) {
    setBusyPost(post.id)
    try {
      await setPostPinned(post.id, !post.pinned_at)
      posts.reload()
      toast(post.pinned_at ? 'Post unpinned.' : 'Pinned to the top.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not change the pin.', 'error')
    } finally {
      setBusyPost(null)
    }
  }

  async function assign(post: Post, categoryId: string | null) {
    setBusyPost(post.id)
    try {
      await setPostCategory(post.id, categoryId)
      posts.reload()
      categories.reload()
      void reloadSidebar()
      toast(categoryId ? 'Post labelled.' : 'Label cleared.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not label the post.', 'error')
    } finally {
      setBusyPost(null)
    }
  }

  const counts = useMemo(() => list.reduce((sum, item) => sum + categoryCount(item), 0), [list])

  return (
    <div className="space-y-3">
      <section className="card overflow-hidden">
        <div className="border-b border-hair/70 px-4 py-3.5">
          <h2 className="inline-flex items-center gap-2 text-[13px] font-semibold">
            <Tag className="size-4 text-muted" />
            Labels
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            The shelves of the timeline. {list.length} {list.length === 1 ? 'label' : 'labels'} ·{' '}
            {counts} filed {counts === 1 ? 'post' : 'posts'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-hair/70 bg-[#fcfcfe] px-4 py-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addLabel()
            }}
            maxLength={32}
            placeholder="New label, e.g. Weekend plans"
            aria-label="New label name"
            className="field !w-[240px] flex-1 !py-1.5 !text-[12.5px]"
          />
          <AccentPicker value={accentName} onChange={setAccentName} />
          <button
            type="button"
            onClick={() => void addLabel()}
            disabled={creating || name.trim().length === 0}
            className="btn btn-primary !px-3 !py-1.5 !text-[12px]"
          >
            {creating ? <Spinner /> : <Plus className="size-3.5" />}
            Add
          </button>
        </div>

        {categories.error ? (
          <div className="p-4">
            <ErrorNote message={categories.error} onRetry={categories.reload} />
          </div>
        ) : categories.loading && !categories.data ? (
          <div className="space-y-2 p-4">
            {[0, 1].map((index) => (
              <span key={index} className="skeleton block h-8 w-full rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Tag className="size-5" />}
              title="No labels yet"
              description="Create the first shelf above, then file posts into it below. Labels show up in everyone's sidebar."
            />
          </div>
        ) : (
          list.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onChanged={refreshAll}
              onDelete={() => setPendingDelete(category)}
            />
          ))
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-hair/70 px-4 py-3.5">
          <h2 className="text-[13px] font-semibold">File the timeline</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            Only admins can label or pin a post. Pinning keeps one post at the top of its label.
          </p>
        </div>

        {posts.error ? (
          <div className="p-4">
            <ErrorNote message={posts.error} onRetry={posts.reload} />
          </div>
        ) : posts.loading && !posts.data ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((index) => (
              <span key={index} className="skeleton block h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (posts.data ?? []).length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Tag className="size-5" />}
              title="Nothing to file yet"
              description="Once someone posts, their post appears here with a picker."
            />
          </div>
        ) : (
          <ul className="divide-y divide-hair/70">
            {(posts.data ?? []).map((post) => {
              const title = post.title || post.body || 'A post with an attachment'
              const current = categories.data?.find((item) => item.id === post.category_id)
              return (
                <li key={post.id} className="flex flex-wrap items-center gap-2.5 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{title}</p>
                    <p className="mt-0.5 text-[10.5px] text-faint">
                      {post.author?.display_name ?? 'Member'} · {relativeTime(post.created_at)}
                    </p>
                  </div>
                  {busyPost === post.id ? <Spinner className="text-muted" /> : null}
                  <button
                    type="button"
                    onClick={() => void togglePin(post)}
                    aria-pressed={Boolean(post.pinned_at)}
                    aria-label={post.pinned_at ? `Unpin ${title}` : `Pin ${title}`}
                    title={post.pinned_at ? 'Pinned to the top — click to unpin' : 'Pin to the top'}
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full transition',
                      post.pinned_at
                        ? 'bg-[#fff6e6] text-[#9a6a12]'
                        : 'text-faint hover:bg-[#f4f4f8] hover:text-ink',
                    )}
                  >
                    <Pin className={cn('size-3.5', post.pinned_at && 'fill-current')} />
                  </button>
                  <select
                    value={post.category_id ?? ''}
                    onChange={(event) => void assign(post, event.target.value || null)}
                    aria-label={`Label for ${title}`}
                    className={cn(
                      'field !w-[160px] !py-1.5 !text-[12px]',
                      current ? accent(current.accent).chip : 'text-muted',
                    )}
                  >
                    <option value="">Unlabelled</option>
                    {(categories.data ?? []).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        description="Posts stay, they simply lose this label. The sidebar entry disappears for everyone."
        width="sm:max-w-[420px]"
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn !bg-[#c8332b] text-white hover:!bg-[#a92a23]"
              onClick={() => {
                const target = pendingDelete
                setPendingDelete(null)
                if (!target) return
                void deleteCategory(target.id)
                  .then(() => {
                    toast('Label deleted.', 'success')
                    refreshAll()
                  })
                  .catch((error: unknown) =>
                    toast(error instanceof Error ? error.message : 'Could not delete.', 'error'),
                  )
              }}
            >
              <Trash2 className="size-3.5" />
              Delete label
            </button>
          </>
        }
      >
        <p className="rounded-xl bg-[#f7f7fa] px-3.5 py-3 text-[13px] text-muted">
          Everything filed under this label becomes unlabelled until you file it again.
        </p>
      </Modal>
    </div>
  )
}
