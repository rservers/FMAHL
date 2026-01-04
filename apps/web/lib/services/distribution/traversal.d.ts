/**
 * Level Traversal Service for EPIC 06
 *
 * Determines the order in which competition levels should be traversed
 * during distribution, starting from a given position.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
export interface LevelTraversalInfo {
    levelId: string;
    orderPosition: number;
    maxRecipients: number;
    pricePerLeadCents: number;
}
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
export declare function getTraversalOrder(nicheId: string, startOrderPosition: number): Promise<LevelTraversalInfo[]>;
//# sourceMappingURL=traversal.d.ts.map