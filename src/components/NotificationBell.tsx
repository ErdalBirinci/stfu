import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { notificationHref, notificationText, useNotifications } from '../lib/notifications'
import { relativeTime } from '../lib/format'
import { cn } from '../lib/cn'
import { Avatar } from './Avatar'

export function NotificationBell({
  align = 'right',
  direction = 'down',
  withLabel = false,
}: {
  align?: 'left' | 'right'
  direction?: 'down' | 'up'
  withLabel?: boolean
}) {
  const { items, unread, loading, open, setOpen, markAllRead } = useNotifications()

  function close() {
    setOpen(false)
    void markAllRead()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className={cn(
          'relative inline-flex items-center gap-2.5 rounded-xl transition',
          withLabel
            ? 'w-full px-3 py-2.5 text-[13.5px] font-medium text-muted hover:bg-white/60 hover:text-ink'
            : 'grid size-9 place-items-center text-muted hover:bg-[#f1f1f5] hover:text-ink',
        )}
      >
        <Bell className="size-4" />
        {withLabel ? <span>Notifications</span> : null}
        {unread > 0 ? (
          <span
            className={cn(
              'grid min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[17px] text-white',
              withLabel ? 'ml-auto' : 'absolute -right-0.5 -top-0.5 size-[17px] min-w-0',
            )}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            onClick={close}
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            className={cn(
              'card absolute z-50 max-h-[62vh] w-[330px] max-w-[calc(100vw-32px)] overflow-hidden p-1.5 shadow-[0_24px_60px_-28px_rgba(20,20,43,0.45)]',
              align === 'right' ? 'right-0' : 'left-0',
              direction === 'up' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
            )}
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">Notifications</p>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-medium text-accent transition hover:bg-accent-soft"
                >
                  <CheckCheck className="size-3.5" />
                  Mark read
                </button>
              ) : null}
            </div>

            <div className="no-scrollbar max-h-[52vh] space-y-0.5 overflow-y-auto">
              {loading && items.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12.5px] text-faint">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-3 py-7 text-center text-[12.5px] text-faint">
                  Nothing yet. Post something and the circle will hear about it.
                </p>
              ) : (
                items.map((item) => (
                  <Link
                    key={item.id}
                    to={notificationHref(item)}
                    onClick={close}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-[#f5f6fa]',
                      !item.read_at ? 'bg-[#f8fbff]' : null,
                    )}
                  >
                    <Avatar
                      name={item.actor?.display_name ?? 'STFU'}
                      path={item.actor?.avatar_url}
                      size={28}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] leading-snug text-[#33333a]">
                        {notificationText(item)}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-faint">
                        {relativeTime(item.created_at)}
                      </span>
                    </span>
                    {!item.read_at ? (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                    ) : null}
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
