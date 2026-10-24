import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import heroPhoto from '../assets/hero-dogs.webp'

const frames = [
  { key: 'quiet', label: 'good dogs keep quiet', origin: '24% 44%', zoom: 1.75, tilt: -1.1 },
  { key: 'shush', label: 'the gentle shush', origin: '72% 62%', zoom: 1.68, tilt: 0.9 },
  { key: 'gang', label: 'the whole gang', origin: '50% 46%', zoom: 1.02, tilt: -0.3 },
]

const HOLD_MS = 6200

export function MemoryCollage() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return

    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % frames.length)
    }, HOLD_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="collage"
      role="img"
      aria-label="A memory wall that cycles through moments of a jack russell terrier in sunglasses shushing a wide-eyed golden retriever"
    >
      <span className="collage__back collage__back--a" aria-hidden />
      <span className="collage__back collage__back--b" aria-hidden />

      <figure className="collage__card" style={{ '--tilt': `${frames[active].tilt}deg` } as CSSProperties}>
        {frames.map((frame) => (
          <img
            key={frame.key}
            className="collage__layer"
            data-active={frame.key === frames[active].key}
            src={heroPhoto}
            alt=""
            aria-hidden
            decoding="async"
            style={{ transform: `scale(${frame.zoom})`, transformOrigin: frame.origin }}
          />
        ))}

        <figcaption className="collage__badge">
          <span aria-hidden>🤫</span>
          <span className="collage__label" key={frames[active].key}>
            {frames[active].label}
          </span>
        </figcaption>
      </figure>

      <div className="collage__dots" aria-hidden>
        {frames.map((frame) => (
          <span key={frame.key} className="collage__dot" data-active={frame.key === frames[active].key} />
        ))}
      </div>
    </div>
  )
}
