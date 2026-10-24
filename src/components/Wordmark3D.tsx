import { cn } from '../lib/cn'

const LINES = ['Shut The', 'Fuck Up']

function WordmarkStack() {
  return (
    <div className="wordmark__float">
      <div className="wordmark__plate">
        {LINES.map((line) => (
          <span key={line} className="wordmark__word" data-text={line}>
            {line}
          </span>
        ))}
      </div>
    </div>
  )
}

function FunDecor() {
  return (
    <>
      <span className="wordmark__chip wordmark__chip--a" aria-hidden>
        <span className="wordmark__chip-emoji">🤫</span>
        just us
      </span>
      <span className="wordmark__chip wordmark__chip--b" aria-hidden>
        no lurkers
        <span className="wordmark__chip-emoji">👀</span>
      </span>

      <span className="wordmark__spark wordmark__spark--a" aria-hidden>
        ✦
      </span>
      <span className="wordmark__spark wordmark__spark--b" aria-hidden>
        ✦
      </span>
      <span className="wordmark__spark wordmark__spark--c" aria-hidden>
        ✦
      </span>
    </>
  )
}

function FunSwoosh() {
  return (
    <svg className="wordmark__swoosh" viewBox="0 0 320 44" fill="none" aria-hidden>
      <defs>
        <linearGradient id="wordmark-swoosh" x1="8" y1="14" x2="312" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a6cf5" />
          <stop offset="0.55" stopColor="#7a5cff" />
          <stop offset="1" stopColor="#ff5fa2" />
        </linearGradient>
      </defs>
      <path
        d="M8 28C52 8 92 34 138 22C184 10 214 32 256 20C282 12 300 16 312 22"
        stroke="url(#wordmark-swoosh)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Wordmark3D({ className, fun = false }: { className?: string; fun?: boolean }) {
  return (
    <div className={cn('wordmark', fun && 'wordmark--fun', className)} role="img" aria-label="Shut The Fuck Up">
      <span className="wordmark__glow" aria-hidden />
      {fun ? <FunDecor /> : null}
      <WordmarkStack />
      {fun ? <FunSwoosh /> : null}
      <div className="wordmark__reflection" aria-hidden>
        <WordmarkStack />
      </div>
    </div>
  )
}
