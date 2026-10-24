import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#f4f4f8] text-muted">
        <Compass className="size-5" />
      </span>
      <h1 className="text-[19px] font-semibold">This page does not exist</h1>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
        The link may be old, or the door you are looking for was never here.
      </p>
      <Link to="/" className="btn btn-quiet mt-5">
        Back to the timeline
      </Link>
    </div>
  )
}
