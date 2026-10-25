import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { accent, categoryCount, useCategories } from '../lib/categories'
import { cn } from '../lib/cn'
import { usePresence } from '../lib/presence'
import { Avatar } from './Avatar'

const sectionTitle = 'text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint'

export function OnlineNow() {
  const { profile } = useAuth()
  const online = usePresence()

  return (
    <section aria-label="Who is online">
      <div className="flex items-center justify-between px-3 pb-1.5">
        <p className={sectionTitle}>Online now</p>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-positive">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#34c759] opacity-60" />
            <span className="relative size-1.5 rounded-full bg-[#34c759]" />
          </span>
          {online.length}
        </span>
      </div>

      {online.length === 0 ? (
        <p className="px-3 text-[11.5px] leading-relaxed text-faint">
          Nobody else has the circle open right now.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {online.slice(0, 6).map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition hover:bg-white/60"
            >
              <span className="relative shrink-0">
                <Avatar name={member.display_name} path={member.avatar_url} size={22} />
                <span className="absolute -bottom-px -right-px size-2 rounded-full border-2 border-[#f8f8fb] bg-[#34c759]" />
              </span>
              <span className="truncate text-[12px] font-medium text-ink">{member.display_name}</span>
              {member.id === profile?.id ? (
                <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
                  you
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {online.length > 6 ? (
        <p className="px-3 pt-1 text-[10.5px] text-faint">and {online.length - 6} more</p>
      ) : null}
    </section>
  )
}

export function CategoryNav() {
  const { items } = useCategories()
  const [params] = useSearchParams()
  const activeSlug = params.get('category')

  if (items.length === 0) return null

  return (
    <section aria-label="Labels">
      <div className="flex items-center justify-between px-3 pb-1.5">
        <p className={sectionTitle}>Labels</p>
        <Link
          to="/"
          className={cn(
            'text-[10.5px] font-semibold transition',
            activeSlug ? 'text-faint hover:text-ink' : 'text-accent',
          )}
        >
          All
        </Link>
      </div>

      <div className="space-y-0.5">
        {items.map((category) => {
          const active = activeSlug === category.slug
          return (
            <Link
              key={category.id}
              to={`/?category=${encodeURIComponent(category.slug)}`}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium transition',
                active
                  ? 'bg-white text-ink shadow-[0_1px_2px_rgba(20,20,43,0.06)]'
                  : 'text-muted hover:bg-white/60 hover:text-ink',
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', accent(category.accent).dot)} />
              <span className="min-w-0 flex-1 truncate">{category.name}</span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-faint">
                {categoryCount(category)}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
