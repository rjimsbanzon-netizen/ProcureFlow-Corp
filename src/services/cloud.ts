// @ts-nocheck
import { renderApp } from '../core/renderBridge';
import { syncRequisitionStatuses } from '../domain/procurement';
import { logAudit } from './audit';
import { Storage } from './storage';
import { showToast } from './toast';
import { DB, setDB, ui } from '../store/state';
import { normalizeMatrix } from '../domain/accessMatrix';
import {clearActingResponsibilities,setActingResponsibilities} from '../domain/effectiveDelegation';

// Migrated from enterprise.html. Business rules / markup preserved.
export const CLOUD_TOKEN_KEY = 'procurement_enterprise_token';
export const CLOUD_USERNAME_KEY = 'procurement_enterprise_username';
export const CLOUD_RECORD_COLLECTIONS = [
  'stockNeeds', 'bids', 'proposalMeetings', 'requisitions', 'orders',
  'deliveries', 'amendments', 'payments', 'suppliers', 'ratings', 'auditLogs'
] as const;
function getCloudApiBase(): string {
  const win = window as Window & { procurecorpApiBase?: string };
  let parentBase = '';
  try { parentBase = (window.parent as typeof win).procurecorpApiBase || ''; }
  catch { /* Embedded in a different origin. */ }
  return import.meta.env.VITE_API_BASE_URL || parentBase || win.procurecorpApiBase || '';
}
export const CLOUD_API_BASE = getCloudApiBase();

export async function cloudRequest(path, options = {}, token = localStorage.getItem(CLOUD_TOKEN_KEY)) {
    const response = await fetch(`${CLOUD_API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
    let body = {};
    try {
        body = await response.json();
    } catch (error) {
        if (response.ok) throw new Error('Cloud API returned an invalid response.');
    }
    if (!response.ok) {
        if (response.status === 401 && token === localStorage.getItem(CLOUD_TOKEN_KEY)) {
            localStorage.removeItem(CLOUD_TOKEN_KEY);
            localStorage.removeItem(CLOUD_USERNAME_KEY);
        }
        throw new Error(body.error || `Cloud API request failed (${response.status}).`);
    }
    return body;
}


export function mapCloudUser(user, suppliers = []) {
    if (!user) throw new Error('Cloud account details are missing.');
    const role = user.app_role || (user.role === 'admin' ? 'Admin' : user.role === 'guest' ? 'Supplier' : 'Employee');
    const supplier = role === 'Supplier'
        ? suppliers.find(item => item.name.toLowerCase() === (user.company_name || '').toLowerCase())
        : null;
    return {
        id: user.id,
        username: user.username,
        requestedPosition: user.requested_position || 'Employee',
        usernameAliases: Array.isArray(user.usernameAliases) ? user.usernameAliases : (() => { try { return JSON.parse(user.username_aliases || '[]'); } catch { return []; } })(),
        nameAliases: Array.isArray(user.nameAliases) ? user.nameAliases : (() => { try { return JSON.parse(user.name_aliases || '[]'); } catch { return []; } })(),
        name: user.name,
        email: user.email,
        role,
        department: role === 'Admin' ? 'Executive' : role === 'Supplier' ? (user.company_name || 'External Vendor') : (user.department || 'Unassigned'),
        companyName: user.company_name || '',
        accessRevoked: Boolean(user.access_revoked),
        status: user.access_revoked ? 'Access Revoked' : user.status === 'pending' ? 'Pending Verification' : user.status === 'rejected' ? 'Rejected' : 'Active',
        supplierId: supplier?.id ?? (role === 'Supplier' ? `supplier-${user.id}` : null)
    };
}


export function applyCloudState(data, user, users = [user], accessControl = null) {
    const state = Storage.empty();
    if (data !== null) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Cloud business data has an invalid format.');
        }
        CLOUD_RECORD_COLLECTIONS.forEach(collection => {
            if (!Array.isArray(data[collection])) {
                throw new Error(`Cloud business data is missing ${collection}.`);
            }
            state[collection] = data[collection];
        });
    }
    if (
        user.role === 'Supplier' &&
        user.supplierId &&
        !state.suppliers.some(supplier => supplier.id === user.supplierId)
    ) {
        state.suppliers.push({
            id: user.supplierId,
            name: user.companyName || user.name,
            contact: user.name,
            email: user.email || '',
            phone: '',
            category: 'Registered Supplier'
        });
    }
    state.permissions=normalizeMatrix(accessControl?.permissions || null);

    state.users = users.map(account => mapCloudUser(account, state.suppliers));
    state.currentUser = user;
    setDB(state);
    if (syncRequisitionStatuses(state)) Storage.save(state);
}


/** Synchronize time-bound delegated capabilities from the authenticated Worker.
 * The response is trusted for UI hints only; the Worker rechecks every mutation.
 */
// Discard older concurrent refresh responses. A delayed response must never
// reinstate acting-role UI after a newer revocation check has cleared it.
let delegationRefreshSequence = 0;
export async function refreshActiveDelegationAccess() {
    const requestSequence = ++delegationRefreshSequence;
    const user = DB.currentUser;
    if (!CLOUD_API_BASE || !user || user.role === 'Admin' || user.role === 'Supplier') {
        return clearActingResponsibilities();
    }
    try {
        const result = await cloudRequest('/delegations');
        if (requestSequence !== delegationRefreshSequence || DB.currentUser?.id !== user.id) return false;
        return setActingResponsibilities(user.id, result);
    } catch (error) {
        // Missing cloud confirmation must remove acting-role UI, not leave a
        // previously approved delegation available in local permissions.
        if (requestSequence !== delegationRefreshSequence || DB.currentUser?.id !== user.id) return false;
        return clearActingResponsibilities();
    }
}

export async function restoreCloudSession() {
    const token = localStorage.getItem(CLOUD_TOKEN_KEY);
    if (!token) {
        delegationRefreshSequence++;
        clearActingResponsibilities();
        localStorage.removeItem(CLOUD_TOKEN_KEY);
        localStorage.removeItem(CLOUD_USERNAME_KEY);
        renderApp();
        return;
    }

    try {
        const [session, snapshot, accessControl] = await Promise.all([
            cloudRequest('/auth/me'),
            cloudRequest('/enterprise-state'),
            cloudRequest('/access-control')
        ]);
        const account = session.user;
        const user = mapCloudUser(account, snapshot.data?.suppliers || []);
        const users = account.role === 'admin' ? await cloudRequest('/users') : [account];
        applyCloudState(snapshot.data, user, users, accessControl);
        await refreshActiveDelegationAccess();
        renderApp();
    } catch (error) {
        delegationRefreshSequence++;
        clearActingResponsibilities();
        localStorage.removeItem(CLOUD_TOKEN_KEY);
        localStorage.removeItem(CLOUD_USERNAME_KEY);
        setDB(Storage.empty());
        console.error('Cloud session could not be restored.', error);
        showToast('Cloud session could not be restored. Please sign in again.', 'warning');
        renderApp();
    }
}


export async function signInToCloud(username, password) {
    const response = await cloudRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    }, null);
    if (response.pending) {
        throw new Error('Your registration is awaiting administrator verification.');
    }
    if (response.rejected) {
        throw new Error('This account was rejected. Choose Register Account and resubmit using the same username, email, and password.');
    }
    if (response.accessRevoked) {
        throw new Error('Access to this account has been revoked. Contact an administrator.');
    }
    if (!response.user || !response.token) {
        throw new Error('Invalid username or password.');
    }

    try {
        const [snapshot, accessControl] = await Promise.all([
            cloudRequest('/enterprise-state', {}, response.token),
            cloudRequest('/access-control', {}, response.token)
        ]);
        const user = mapCloudUser(response.user, snapshot.data?.suppliers || []);
        const users = user.role === 'Admin'
            ? await cloudRequest('/users', {}, response.token)
            : [response.user];
        localStorage.setItem(CLOUD_TOKEN_KEY, response.token);
        localStorage.setItem(CLOUD_USERNAME_KEY, user.username);
        applyCloudState(snapshot.data, user, users, accessControl);
        await refreshActiveDelegationAccess();
    } catch (error) {
        localStorage.removeItem(CLOUD_TOKEN_KEY);
        localStorage.removeItem(CLOUD_USERNAME_KEY);
        throw error;
    }

    const user = DB.currentUser;
    logAudit('User Login', `User ${user.name} signed in successfully.`);
    showToast(`Welcome back, ${user.name}!`, 'success');
    renderApp();
}


export async function registerCloudAccount(account) {
    const response = await cloudRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(account)
    }, null);
    showToast(
        response.reapplied
            ? 'Your registration has been resubmitted for administrator review.'
            : 'Registration submitted. An administrator must verify your account before you can sign in.',
        'success'
    );
    ui.authMode = 'login';
    renderApp();
}
