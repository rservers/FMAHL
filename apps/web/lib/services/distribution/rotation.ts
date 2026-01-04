/**
 * Starting Level Rotation Service for EPIC 06
 * 
 * Implements atomic read-and-advance of next_start_level_order_position
 * to ensure fair across-level distribution.
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { sql } from '../../db'

/**
 * Get the starting level order position for a niche and advance it atomically
 * 
 * Uses SELECT FOR UPDATE to prevent race conditions when multiple leads
 * are distributed concurrently in the same niche.
 * 
 * Wraps around to 1 when exceeding max order_position.
 * 
 * @param nicheId - Niche ID
 * @returns Starting order position and ordered list of competition level IDs
 */
export async function getAndAdvanceStartLevel(nicheId: string): Promise<{
  startOrderPosition: number
  competitionLevelIds: string[]
}> {
  return sql.begin(async (sql) => {
    // Lock the niche row for update (prevents concurrent modifications)
    const [niche] = await sql`
      SELECT next_start_level_order_position
      FROM niches
      WHERE id = ${nicheId}
      FOR UPDATE
    `

    if (!niche) {
      throw new Error(`Niche not found: ${nicheId}`)
    }

    const currentPosition = niche.next_start_level_order_position

    // Get all active competition levels for this niche, ordered by order_position
    const levels = await sql`
      SELECT id, order_position
      FROM competition_levels
      WHERE niche_id = ${nicheId}
        AND is_active = true
        AND deleted_at IS NULL
      ORDER BY order_position ASC
    `

    if (levels.length === 0) {
      throw new Error(`No active competition levels found for niche: ${nicheId}`)
    }

    // Find the max order_position
    const maxOrderPosition = Math.max(...levels.map(l => l.order_position))

    // Calculate next position (wrap around if exceeds max)
    const nextPosition = currentPosition > maxOrderPosition ? 1 : currentPosition + 1

    // Update the niche with the new position
    await sql`
      UPDATE niches
      SET next_start_level_order_position = ${nextPosition}
      WHERE id = ${nicheId}
    `

    // Build traversal order starting from current position
    const levelMap = new Map(levels.map(l => [l.order_position, l.id]))
    const traversalOrder: string[] = []

    // Start from current position and wrap around
    for (let i = 0; i < levels.length; i++) {
      const position = ((currentPosition - 1 + i) % maxOrderPosition) + 1
      const levelId = levelMap.get(position)
      if (levelId) {
        traversalOrder.push(levelId)
      }
    }

    return {
      startOrderPosition: currentPosition,
      competitionLevelIds: traversalOrder,
    }
  })
}

