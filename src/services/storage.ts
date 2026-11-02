// @ts-nocheck
import { INITIAL_STATE } from '../data/initialState';
import { syncRequisitionStatuses } from '../domain/procurement';
import { CLOUD_API_BASE, CLOUD_RECORD_COLLECTIONS, CLOUD_TOKEN_KEY, cloudRequest } from './cloud';
import { showToast } from './toast';
import { DB, setDB } from '../store/state';
import { normalizeMatrix } from '../domain/accessMatrix';

// Local persistence + serialized Cloudflare API sync.
let cloudSaveQueue = Promise.resolve();
let cloudSaveError = null;
export class Storage {
    static empty() {
        return {
            ...INITIAL_STATE,
            currentUser: null,
            permissions: Object.fromEntries(
                Object.entries(INITIAL_STATE.permissions).map(([role, permissions]) => [role, [...permissions]])
            ),
            users: [],
            stockNeeds: [],
            bids: [],
            proposalMeetings: [],
            requisitions: [],
            orders: [],
            deliveries: [],
            amendments: [],
            payments: [],
            suppliers: [],
            ratings: [],
            auditLogs: [],
            accessControl: [],
            nonAdminUsersPruned: true
        };
    }

    static get() {
        const data = localStorage.getItem('eprocurement_db');
        if (!data) {
            localStorage.setItem('eprocurement_db', JSON.stringify(INITIAL_STATE));
            return INITIAL_STATE;
        }
        try {
            const parsed = JSON.parse(data);
            // Ensure permissions fallback if upgraded
            parsed.permissions=normalizeMatrix(parsed.permissions);
            if (!parsed.ratings) parsed.ratings = INITIAL_STATE.ratings;
            if (!parsed.stockNeeds) parsed.stockNeeds = INITIAL_STATE.stockNeeds;
            if (!parsed.bids) parsed.bids = INITIAL_STATE.bids;
            if (!parsed.proposalMeetings) parsed.proposalMeetings = INITIAL_STATE.proposalMeetings;
            if (!parsed.nonAdminUsersPruned) {
                const originalUserCount = Array.isArray(parsed.users) ? parsed.users.length : 0;
                parsed.users = (Array.isArray(parsed.users) ? parsed.users : [])
                    .filter(user => user.role === 'Admin');
                if (parsed.currentUser && parsed.currentUser.role !== 'Admin') {
                    parsed.currentUser = null;
                }
                parsed.nonAdminUsersPruned = true;
                if (parsed.users.length < originalUserCount) {
                    parsed.auditLogs = Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [];
                    parsed.auditLogs.unshift({
                        id: 'log-' + Date.now(),
                        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
                        user: 'System',
                        role: 'System',
                        action: 'Non-admin Accounts Removed',
                        details: 'One-time account cleanup removed all non-admin enterprise user accounts.'
                    });
                }
                localStorage.setItem('eprocurement_db', JSON.stringify(parsed));
            }
            Object.keys(parsed.permissions).forEach(role => {
                const rolePermissions = parsed.permissions[role];
                if (rolePermissions.includes('issue_po') && !rolePermissions.includes('manage_suppliers')) {
                    rolePermissions.push('manage_suppliers');
                }
            });
            return parsed;
        } catch(e) {
            return INITIAL_STATE;
        }
    }

    static save(state) {
        syncRequisitionStatuses(state);
        localStorage.setItem('eprocurement_db', JSON.stringify(state));
        const token = CLOUD_API_BASE ? localStorage.getItem(CLOUD_TOKEN_KEY) : null;
        if (!token) return;

        const data = Object.fromEntries(
            CLOUD_RECORD_COLLECTIONS.map(collection => [collection, state[collection]])
        );
        cloudSaveQueue = cloudSaveQueue.then(async () => {
            await cloudRequest('/enterprise-state', {
                method: 'PUT',
                body: JSON.stringify({ data })
            }, token);
            cloudSaveError = null;
        }).catch(error => {
            cloudSaveError = error;
            const reason = error instanceof Error ? error.message : String(error);
            console.error('Enterprise data could not be saved to Cloudflare D1. Server reason:', reason, error);
            // cloudRequest already includes the Worker response's error message.
            // Show it rather than obscuring a useful 409 Conflict or 403 Forbidden.
            showToast(`Cloud save not confirmed: ${reason}`, 'error');
        });
    }

    static async flush() {
        await cloudSaveQueue;
        if (cloudSaveError) {
            const error = cloudSaveError;
            cloudSaveError = null;
            throw error;
        }
    }

    static async reset() {
        if (DB.currentUser?.role !== 'Admin') {
            throw new Error('Admin access is required to clear procurement records.');
        }
        const admin = DB.currentUser;
        const freshState = Storage.empty();
        freshState.users = (DB.users || []).filter(user => user.role === 'Admin');
        freshState.currentUser = admin;
        if (CLOUD_API_BASE) {
            const token = localStorage.getItem(CLOUD_TOKEN_KEY);
            if (!token) throw new Error('Cloud session expired. Sign in again before resetting.');
            // Never clear browser state before D1 commits all deletes atomically.
            try {
                await Storage.flush();
            } catch (saveError) {
                // A failed earlier save is settled; an explicit Admin reset must
                // not be blocked forever by a previously rejected stale snapshot.
                console.warn('Continuing the explicit Admin reset after an earlier failed cloud save.', saveError);
            }
            const result = await cloudRequest('/finance/admin/reset-workspace', {
                method: 'POST',
                body: JSON.stringify({ confirmation: 'RESET' })
            }, token);
            freshState.auditLogs = Array.isArray(result.auditLogs) ? result.auditLogs : [];
        } else {
            freshState.auditLogs = [{
                id: `log-reset-${crypto.randomUUID()}`,
                timestamp: new Date().toISOString(),
                user: admin.name,
                role: 'Admin',
                action: 'Procurement Records Reset',
                details: 'Admin cleared local procurement records and requisition history.'
            }];
        }
        // Prevent this browser from retaining old notification-read markers for
        // reference numbers reused after an Admin clears the workspace.
        Object.keys(localStorage).filter(key => key.startsWith('procureflow_read_notifications_v1_'))
            .forEach(key => localStorage.removeItem(key));
        setDB(freshState);
        localStorage.setItem('eprocurement_db', JSON.stringify(freshState));
        location.reload();
    }
}
