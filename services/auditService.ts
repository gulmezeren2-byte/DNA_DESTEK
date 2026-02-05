/**
 * SEC-010: Audit Logging Service
 * 
 * Logs admin/technician actions for security audit trail.
 * All logs are immutable (create-only, no update/delete).
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type AuditAction =
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'USER_DEACTIVATED'
    | 'ROLE_CHANGED'
    | 'TALEP_CREATED'
    | 'TALEP_ASSIGNED'
    | 'TALEP_STATUS_CHANGED'
    | 'TALEP_CANCELLED'
    | 'TEAM_CREATED'
    | 'TEAM_MODIFIED'
    | 'TEAM_MEMBER_ADDED'
    | 'TEAM_MEMBER_REMOVED'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOGOUT';

export interface AuditLogEntry {
    action: AuditAction;
    performedBy: string; // User ID who performed the action
    performedByEmail?: string; // Email for readability
    targetId?: string | null; // ID of affected resource
    targetType?: 'user' | 'talep' | 'team';
    details: Record<string, any>; // Additional context
    timestamp?: any; // Server timestamp
    clientInfo?: {
        platform: string;
        userAgent?: string;
    };
}

/**
 * Log an audit event to Firestore
 * 
 * @param action - The type of action performed
 * @param performedBy - User ID of the actor
 * @param targetId - ID of the affected resource (optional)
 * @param details - Additional details about the action
 * @param performedByEmail - Email of the actor for readability
 */
export const logAuditEvent = async (
    action: AuditAction,
    performedBy: string,
    targetId: string | null,
    details: Record<string, any>,
    performedByEmail?: string
): Promise<boolean> => {
    try {
        // Don't block on audit logging - fire and forget
        // Scrub sensitive data
        const { password, token, ...safeDetails } = details;

        const logEntry: Partial<AuditLogEntry> = {
            action,
            performedBy,
            performedByEmail,
            targetId: targetId || null, // FIX: Firestore hates undefined
            details: safeDetails,
            timestamp: serverTimestamp(),
            clientInfo: {
                platform: typeof navigator !== 'undefined' ? 'web' : 'mobile',
            }
        };

        await addDoc(collection(db, 'audit_logs'), logEntry);
        return true;
    } catch (error) {
        // Don't throw - audit logging should never break the app
        console.error('SEC-010: Audit log failed:', error);
        return false;
    }
};

/**
 * Convenience functions for common audit events
 */
export const AuditLog = {
    userCreated: (adminId: string, adminEmail: string, newUserId: string, newUserEmail: string, role: string) =>
        logAuditEvent('USER_CREATED', adminId, newUserId, { newUserEmail, role }, adminEmail),

    userUpdated: (adminId: string, adminEmail: string, userId: string, changes: Record<string, any>) =>
        logAuditEvent('USER_UPDATED', adminId, userId, { changes }, adminEmail),

    roleChanged: (adminId: string, adminEmail: string, userId: string, oldRole: string, newRole: string) =>
        logAuditEvent('ROLE_CHANGED', adminId, userId, { oldRole, newRole }, adminEmail),

    talepAssigned: (adminId: string, adminEmail: string, talepId: string, teamId: string, teamName: string) =>
        logAuditEvent('TALEP_ASSIGNED', adminId, talepId, { teamId, teamName }, adminEmail),

    talepStatusChanged: (userId: string, userEmail: string, talepId: string, oldStatus: string, newStatus: string) =>
        logAuditEvent('TALEP_STATUS_CHANGED', userId, talepId, { oldStatus, newStatus }, userEmail),

    loginSuccess: (userId: string, email: string) =>
        logAuditEvent('LOGIN_SUCCESS', userId, null, { email }, email),

    loginFailed: (email: string, reason: string) =>
        logAuditEvent('LOGIN_FAILED', 'anonymous', null, { email, reason }),

    logout: (userId: string, email: string) =>
        logAuditEvent('LOGOUT', userId, null, {}, email),
};

export default AuditLog;
