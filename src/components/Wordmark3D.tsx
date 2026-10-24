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

export function Wordmark3D({ className }: { className?: string }) {
  return (
    <div className={cn('wordmark', className)} role="img" aria-label="Shut The Fuck Up">
      <span className="wordmark__glow" aria-hidden />
      <WordmarkStack />
      <div className="wordmark__reflection" aria-hidden>
        <WordmarkStack />
      </div>
    </div>
  )
}
