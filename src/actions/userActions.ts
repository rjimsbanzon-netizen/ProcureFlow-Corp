// @ts-nocheck
import { confirmAction } from '../services/actionDialogs';
import { renderApp } from '../core/renderBridge';
import { logAudit } from '../services/audit';
import { CLOUD_API_BASE, cloudRequest } from '../services/cloud';
import { Storage } from '../services/storage';
import { showToast } from '../services/toast';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export async function approveUser(userId) {
    const u = DB.users.find(usr => usr.id === userId);
    if (u) {
        if (CLOUD_API_BASE) {
            try {
                await cloudRequest(`/users/${encodeURIComponent(u.id)}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'approved', appRole: u.role, accessRevoked: false })
                });
            } catch (error) {
                showToast(error instanceof Error ? error.message : 'Account approval failed.', 'error');
                return;
            }
        }
        u.accessRevoked = false;
        u.status = 'Active';
        logAudit('User Authorized', `User ${u.name} (@${u.username}) approved by Admin.`);
        Storage.save(DB);
        showToast('User account approved successfully.', 'success');
        renderApp();
    }
}


export async function rejectUser(userId) {
    const u = DB.users.find(usr => usr.id === userId);
    if (!u) return;
    if (CLOUD_API_BASE) {
        try {
            await cloudRequest(`/users/${encodeURIComponent(u.id)}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'rejected', appRole: u.role })
            });
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Account rejection failed.', 'error');
            return;
        }
    }
    u.status = 'Rejected';
    logAudit('User Registration Rejected', `Admin rejected ${u.name} (@${u.username}).`);
    Storage.save(DB);
    showToast('User registration rejected.', 'warning');
    renderApp();
}


export async function revokeUser(userId) {
    const u = DB.users.find(usr => usr.id === userId);
    if (!u || u.role === 'Admin') return;
    if (!await confirmAction({title:'Revoke account access',message:`Revoke access for ${u.name} (@${u.username})? They will be signed out and unable to sign in until access is restored.`,tone:'warning',confirmText:'Revoke access'})) return;
    if (CLOUD_API_BASE) {
        try {
            await cloudRequest(`/users/${encodeURIComponent(u.id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: u.status === 'Rejected' ? 'rejected' : 'approved',
                    accessRevoked: true
                })
            });
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Access revocation failed.', 'error');
            return;
        }
    }
    u.accessRevoked = true;
    u.status = 'Access Revoked';
    logAudit('User Access Revoked', `Admin revoked access for ${u.name} (@${u.username}).`);
    Storage.save(DB);
    showToast('User access revoked and active sessions invalidated.', 'success');
    renderApp();
}


export async function deleteUserAccount(userId) {
    const u = DB.users.find(usr => usr.id === userId);
    if (!u || u.role === 'Admin') return;
    if (!await confirmAction({title:'Remove approved account',message:`Remove ${u.name} (@${u.username}) from active accounts? Their login, appointments and delegations will end, while historical procurement and audit records remain available.`,tone:'danger',confirmText:'Remove account'})) return;
    if (CLOUD_API_BASE) {
        try {
            await cloudRequest(`/users/${encodeURIComponent(u.id)}`, { method: 'DELETE' });
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Account deletion failed.', 'error');
            return;
        }
    }
    DB.users = DB.users.filter(account => account.id !== userId);
    logAudit('User Account Deleted', `Admin permanently deleted ${u.name} (@${u.username}).`);
    Storage.save(DB);
    showToast('Account removed from active users; procurement history retained.', 'success');
    renderApp();
}


// The Users screen uses an explicit Save button. A changed dropdown alone is not
// a persisted permission change; this avoids misleading, unsaved visual state.
export async function saveUserRole(userId) {
    const selected = document.getElementById(`user-role-${userId}`);
    if (!(selected instanceof HTMLSelectElement)) {
        showToast('Role selector could not be found. Refresh and try again.', 'error');
        return;
    }
    await updateUserRole(userId, selected.value);
}


export async function updateUserRole(userId, newRole) {
    const u = DB.users.find(usr => usr.id === userId);
    const permittedRoles = ['Employee', 'Procurement Officer', 'Procurement Head', 'Supplier'];
    if (DB.currentUser?.role !== 'Admin' || !u || u.role === 'Admin' || !permittedRoles.includes(newRole)) {
        showToast('Only Admin can assign a supported user role.', 'error');
        renderApp();
        return;
    }
    if (u.role === newRole) {
        showToast(`${u.name} is already assigned as ${newRole}.`, 'info');
        renderApp();
        return;
    }

    const previousRole = u.role;
    try {
        if (CLOUD_API_BASE) {
            const result = await cloudRequest(`/users/${encodeURIComponent(u.id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: u.status === 'Pending Verification' ? 'pending' : u.status === 'Rejected' ? 'rejected' : 'approved',
                    appRole: newRole,
                    accessRevoked: Boolean(u.accessRevoked)
                })
            });
            if (!result?.ok) throw new Error('Cloudflare did not confirm the role update.');

            // Read the saved row from D1, not the unpersisted select value.
            // User accounts are NOT stored in /enterprise-state.
            const accountRows = await cloudRequest('/users', { cache: 'no-store' });
            const stored = Array.isArray(accountRows) ? accountRows.find(item => item.id === u.id) : null;
            if (!stored || stored.app_role !== newRole) {
                throw new Error('Role update could not be verified in Cloudflare D1. Please refresh and check again.');
            }
        }
        u.role = newRole;
        logAudit('User Role Updated', `User ${u.name} role changed from ${previousRole} to ${newRole}.`);
        Storage.save(DB);
        showToast(`Saved: ${u.name} is now ${newRole}.`, 'success');
    } catch (error) {
        // Do not claim success or update the locally displayed role on failure.
        showToast(error instanceof Error ? `Role not saved: ${error.message}` : 'User role was not saved.', 'error');
    }
    renderApp();
}


export async function saveAccessControlMatrix() {
    if (DB.currentUser?.role !== 'Admin') {
        showToast('Only Admin can edit the permission matrix.', 'error');
        return;
    }
    const {MATRIX_ROLES, LEGACY_PERMISSIONS, normalizeMatrix}=await import('../domain/accessMatrix');
    const proposed={};
    for (const role of MATRIX_ROLES) {
        const enabled=[];
        for (const action of LEGACY_PERMISSIONS) {
            const cb=Array.from(document.querySelectorAll('input[type="checkbox"][data-role][data-action]'))
                .find(el=>el.getAttribute('data-role')===role&&el.getAttribute('data-action')===action);
            if(cb?.checked)enabled.push(action);
        }
        proposed[role]=enabled;
    }
    const normalized=normalizeMatrix(proposed);
    try {
        if(CLOUD_API_BASE){
            const saved=await cloudRequest('/access-control',{
                method:'PUT',body:JSON.stringify({permissions:normalized})
            });
            if(!saved?.ok)throw new Error('The server did not confirm your permissions update.');
            // Verify the persisted matrix instead of claiming a local-only success.
            const fresh=await cloudRequest('/access-control',{cache:'no-store'});
            for(const role of MATRIX_ROLES){
                const expected=[...normalized[role]].sort().join('|');
                const actual=[...(fresh?.permissions?.[role]||[])].sort().join('|');
                if(expected!==actual)throw new Error(`Could not verify saved permissions for ${role}.`);
            }
        }
        DB.permissions=normalized;
        DB.accessControl=MATRIX_ROLES.map(role=>({role,permissions:[...normalized[role]]}));
        logAudit('Permissions Updated','Admin updated the procurement permissions matrix.');
        await Storage.flush();
        showToast('Permission matrix saved and verified. Workflow restrictions remain enforced.', 'success');
        renderApp();
    }catch(error){
        showToast(error instanceof Error?`Permissions not saved: ${error.message}`:'Permissions could not be saved.','error');
    }
}
