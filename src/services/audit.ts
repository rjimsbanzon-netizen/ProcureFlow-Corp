// @ts-nocheck
import { Storage } from './storage';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function logAudit(action, details) {
    const user = DB.currentUser ? DB.currentUser.name : 'System';
    const role = DB.currentUser ? DB.currentUser.role : 'Guest';
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 16);

    DB.auditLogs.unshift({
        id: 'log-' + Date.now(),
        timestamp,
        user,
        role,
        action,
        details
    });
    Storage.save(DB);
}
