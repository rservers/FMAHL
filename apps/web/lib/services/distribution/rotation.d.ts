/**
 * Starting Level Rotation Service for EPIC 06
 *
 * Implements atomic read-and-advance of next_start_level_order_position
 * to ensure fair across-level distribution.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
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
export declare function getAndAdvanceStartLevel(nicheId: string): Promise<{
    startOrderPosition: number;
    competitionLevelIds: string[];
}>;
//# sourceMappingURL=rotation.d.ts.map