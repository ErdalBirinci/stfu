import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCategories } from './api'
import { useAuth } from './auth'
import type { Category } from './types'

interface CategoriesValue {
  items: Category[]
  loading: boolean
  reload: () => Promise<void>
}

const CategoriesContext = createContext<CategoriesValue | null>(null)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const approved = profile?.status === 'approved'
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!approved) {
      setItems([])
      setLoading(false)
      return
    }
    try {
      setItems(await fetchCategories())
    } catch {
      // The sidebar simply hides labels it cannot read.
    } finally {
      setLoading(false)
    }
  }, [approved])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo<CategoriesValue>(() => ({ items, loading, reload: load }), [items, loading, load])

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>
}

export function useCategories(): CategoriesValue {
  const value = useContext(CategoriesContext)
  if (!value) throw new Error('useCategories must be used inside <CategoriesProvider>')
  return value
}

export function categoryCount(category: Category): number {
  return category.posts?.[0]?.count ?? 0
}

export const ACCENTS: Record<string, { dot: string; chip: string; ring: string }> = {
  blue: { dot: 'bg-[#2f7df6]', chip: 'bg-[#eef5ff] text-[#1b5fc4]', ring: 'ring-[#cfe0fb]' },
  violet: { dot: 'bg-[#7b61ff]', chip: 'bg-[#f2efff] text-[#5b41d6]', ring: 'ring-[#ded6ff]' },
  green: { dot: 'bg-[#1f9d63]', chip: 'bg-[#ecfaf1] text-[#15784b]', ring: 'ring-[#c8ecd7]' },
  amber: { dot: 'bg-[#d99016]', chip: 'bg-[#fff7e6] text-[#98620a]', ring: 'ring-[#f6e2b6]' },
  rose: { dot: 'bg-[#e0526f]', chip: 'bg-[#fff0f3] text-[#b03049]', ring: 'ring-[#fbd3da]' },
  slate: { dot: 'bg-[#69707f]', chip: 'bg-[#f2f3f6] text-[#4b5260]', ring: 'ring-[#e0e2e8]' },
}

export function accent(name: string | null | undefined) {
  return ACCENTS[name ?? 'blue'] ?? ACCENTS.blue
}
