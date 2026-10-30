// src/lib/badges.ts (Player App)
import { supabase } from './supabase'

export interface BadgeInfo {
  id: string
  name: string
  min_points: number
  max_points: number
  image_url: string
}

export async function fetchAllBadges(): Promise<BadgeInfo[]> {
  const { data } = await supabase
    .from('badge_items')
    .select('*')
    .order('min_points', { ascending: true })
  
  return data || []
}

export function getPlayerBadge(points: number, badges: BadgeInfo[]): BadgeInfo | null {
  if (!badges || badges.length === 0) return null
  const safePoints = points || 0
  const matched = [...badges].reverse().find(b => safePoints >= b.min_points)
  return matched || badges[0]
}