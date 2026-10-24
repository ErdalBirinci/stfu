import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, signedUrl } from './media'

export function useSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!path) {
      setUrl(null)
      return
    }
    void signedUrl(path).then((next) => {
      if (alive) setUrl(next)
    })
    return () => {
      alive = false
    }
  }, [path])

  return url
}

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options?: { enabled?: boolean },
): AsyncState<T> & { reload: () => void; setData: (value: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let alive = true
    setState((prev) => ({ data: prev.data, loading: true, error: null }))
    loaderRef
      .current()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (alive) setState({ data: null, loading: false, error: describeError(error) })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  const setData = useCallback((value: T) => {
    setState((prev) => ({ ...prev, data: value, loading: false, error: null }))
  }, [])

  return { ...state, reload, setData }
}

export function useBodyLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}
