export type UserRole = 'admin' | 'provider' | 'end_user' | 'system';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deactivated';
/**
 * JWT Payload structure per EPIC 01
 */
export interface JWTPayload {
    sub: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    iat: number;
    exp: number;
}
/**
 * Legacy payload interface for backwards compatibility
 */
export interface LegacyJWTPayload {
    userId: string;
    email: string;
    role: 'admin' | 'provider' | 'end_user';
    status?: UserStatus;
}
/**
 * MFA temporary token payload
 */
export interface MFATokenPayload {
    sub: string;
    email: string;
    type: 'mfa_challenge';
    iat: number;
    exp: number;
}
/**
 * Sign a JWT token with user data
 * Returns a 7-day access token per EPIC 01
 */
export declare function signToken(user: {
    userId: string;
    email: string;
    role: UserRole;
    status: UserStatus;
}): string;
/**
 * Sign a temporary MFA challenge token (5 minutes)
 * Used when admin with MFA enabled logs in
 */
export declare function signMFAToken(user: {
    userId: string;
    email: string;
}): string;
/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null otherwise
 */
export declare function verifyToken(token: string): JWTPayload | null;
/**
 * Verify an MFA challenge token
 * Returns the payload if valid, null otherwise
 */
export declare function verifyMFAToken(token: string): MFATokenPayload | null;
/**
 * Decode a token without verification (for getting user info from expired tokens)
 * WARNING: Do not use for authorization decisions
 */
export declare function decodeToken(token: string): JWTPayload | null;
/**
 * Hash a token for revocation lookup
 * Uses SHA-256 for fast lookup in Redis
 */
export declare function hashTokenForRevocation(token: string): Promise<string>;
/**
 * Extract token from Authorization header
 * Supports "Bearer <token>" format
 */
export declare function extractTokenFromHeader(authHeader: string | null): string | null;
//# sourceMappingURL=jwt.d.ts.map