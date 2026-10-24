import { CalendarDays, Home, Images } from 'lucide-react'
import heroPhoto from '../assets/hero-dogs.webp'
import { LogoMark } from './Logo'

const features = [
  { icon: Home, title: 'Timeline', detail: 'posts, photos, voice notes' },
  { icon: CalendarDays, title: 'Calendar', detail: 'plans and RSVPs' },
  { icon: Images, title: 'Memories', detail: 'the group archive' },
]

export function AuthHero() {
  return (
    <section className="relative isolate flex min-h-[360px] flex-col overflow-hidden sm:min-h-[440px] lg:min-h-dvh">
      <img
        src={heroPhoto}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full scale-125 object-cover blur-2xl saturate-150"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-white/72" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(115%_85%_at_18%_-10%,rgba(255,255,255,0.95),rgba(255,255,255,0)_62%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0)_55%,rgba(247,247,250,0.9))] lg:block" />

      <header className="flex items-center justify-between gap-3 px-6 pt-5 sm:px-8 sm:pt-6 lg:px-10 lg:pt-8">
        <span className="inline-flex items-center gap-2.5">
          <LogoMark className="size-8 rounded-[11px]" />
          <span className="text-[15px] font-semibold tracking-[-0.03em]">STFU</span>
        </span>
        <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-muted backdrop-blur">
          Invite only
        </span>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-4 sm:px-8 sm:py-5 lg:px-10 lg:py-7">
        <figure className="hero-poster">
          <img
            src={heroPhoto}
            width={1200}
            height={800}
            alt="A jack russell terrier in sunglasses shushing a wide-eyed golden retriever"
          />
          <figcaption className="hero-poster__badge">
            <span aria-hidden>🤫</span>
            just us
          </figcaption>
        </figure>
      </div>

      <div className="px-6 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-12">
        <h2 className="text-[clamp(1.5rem,3.1vw,2.75rem)] font-bold leading-[1.03] tracking-[-0.045em] text-ink">
          Shut the fuck up.
        </h2>
        <p className="mt-2.5 hidden max-w-[430px] text-[13px] leading-relaxed text-muted sm:block">
          And say everything else here — one private timeline, one shared calendar and one photo archive,
          kept for a small circle of friends.
        </p>

        <ul className="mt-5 hidden gap-2.5 sm:grid sm:grid-cols-3">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="flex items-center gap-2.5 rounded-2xl border border-white/80 bg-white/65 px-3 py-2.5 shadow-[0_10px_26px_-22px_rgba(20,20,43,0.6)] backdrop-blur"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-white text-accent shadow-[0_1px_3px_rgba(20,20,43,0.12)]">
                <feature.icon className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold leading-tight">{feature.title}</span>
                <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-faint">
                  {feature.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
