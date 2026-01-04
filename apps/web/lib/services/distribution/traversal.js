/**
 * Level Traversal Service for EPIC 06
 *
 * Determines the order in which competition levels should be traversed
 * during distribution, starting from a given position.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
import { sql } from '../../db';
/**
 * Get the traversal order of competition levels starting from a position
 *
 * Returns level IDs in circular order starting from startOrderPosition.
 * Only includes active levels with is_active = true.
 *
 * @param nicheId - Niche ID
 * @param startOrderPosition - Starting order position
 * @returns Ordered list of level traversal info
 */
export async function getTraversalOrder(nicheId, startOrderPosition) {
    // Get all active competition levels for this niche
    const levels = await sql `
    SELECT 
      id,
      order_position,
      max_recipients,
      price_per_lead_cents
    FROM competition_levels
    WHERE niche_id = ${nicheId}
      AND is_active = true
      AND deleted_at IS NULL
    ORDER BY order_position ASC
  `;
    if (levels.length === 0) {
        return [];
    }
    const maxOrderPosition = Math.max(...levels.map(l => l.order_position));
    // Build traversal order starting from startOrderPosition
    const traversalOrder = [];
    for (let i = 0; i < levels.length; i++) {
        // Calculate position with wraparound
        const position = ((startOrderPosition - 1 + i) % maxOrderPosition) + 1;
        // Find level with this order_position
        const level = levels.find(l => l.order_position === position);
        if (level) {
            traversalOrder.push({
                levelId: level.id,
                orderPosition: level.order_position,
                maxRecipients: level.max_recipients,
                pricePerLeadCents: level.price_per_lead_cents,
            });
        }
    }
    return traversalOrder;
}
//# sourceMappingURL=traversal.js.map