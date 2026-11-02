// @ts-nocheck
import { renderApp } from '../core/renderBridge';
import { logAudit } from '../services/audit';
import { CLOUD_API_BASE, registerCloudAccount, signInToCloud } from '../services/cloud';
import { Storage } from '../services/storage';
import { showToast } from '../services/toast';
import { DB, ui } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function attachAuthEvents() {
    const toggleBtn = document.getElementById('toggle-auth');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            ui.authMode = ui.authMode === 'signup' ? 'login' : 'signup';
            renderApp();
        });
    }

    const accountTypeSelect = document.getElementById('auth-account-type');
    if (accountTypeSelect) {
        accountTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            const deptContainer = document.getElementById('dept-field-container');
            const positionContainer = document.getElementById('position-field-container');
            const supplierSelectContainer = document.getElementById('supplier-select-container');
            const companyContainer = document.getElementById('cloud-supplier-company-container');
            const companyInput = document.getElementById('auth-supplier-company');

            if (type === 'Supplier') {
                deptContainer.classList.add('hidden');
                positionContainer?.classList.add('hidden');
                if (CLOUD_API_BASE) {
                    supplierSelectContainer.classList.add('hidden');
                    companyContainer?.classList.remove('hidden');
                    if (companyInput) companyInput.required = true;
                } else {
                    supplierSelectContainer.classList.remove('hidden');
                }
            } else {
                deptContainer.classList.remove('hidden');
                positionContainer?.classList.remove('hidden');
                supplierSelectContainer.classList.add('hidden');
                document.getElementById('new-supplier-name-container')?.classList.add('hidden');
                companyContainer?.classList.add('hidden');
                if (companyInput) companyInput.required = false;
            }
        });
    }

    const supplierIdSelect = document.getElementById('auth-supplier-id');
    if (supplierIdSelect) {
        supplierIdSelect.addEventListener('change', (e) => {
            const newSupContainer = document.getElementById('new-supplier-name-container');
            if (e.target.value === 'NEW_SUPPLIER') {
                newSupContainer.classList.remove('hidden');
            } else {
                newSupContainer.classList.add('hidden');
            }
        });
    }

    const form = document.getElementById('auth-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value;

            if (CLOUD_API_BASE && ui.authMode === 'signup') {
                try {
                    await registerCloudAccount({
                        username,
                        password,
                        name: document.getElementById('auth-name').value.trim(),
                        email: document.getElementById('auth-email').value.trim(),
                        accountType: document.getElementById('auth-account-type').value === 'Supplier' ? 'supplier' : 'employee',
                        department: document.getElementById('auth-dept').value,
                        companyName: document.getElementById('auth-supplier-company')?.value.trim() || '',
                        requestedPosition: document.getElementById('auth-requested-position')?.value || 'Employee'
                    });
                } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Cloud registration failed.', 'error');
                }
                return;
            }

            if (CLOUD_API_BASE) {
                try {
                    await signInToCloud(username, password);
                } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Cloud sign-in failed.', 'error');
                }
                return;
            }

            if (ui.authMode === 'signup') {
                const name = document.getElementById('auth-name').value.trim();
                const email = document.getElementById('auth-email').value.trim();
                const accountType = document.getElementById('auth-account-type').value;

                if (DB.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                    showToast('Username already taken.', 'error');
                    return;
                }

                let assignedSupplierId = null;
                let dept = 'External Vendor';

                if (accountType === 'Supplier') {
                    const supSelectVal = document.getElementById('auth-supplier-id').value;
                    if (supSelectVal === 'NEW_SUPPLIER') {
                        const newSupName = document.getElementById('auth-new-supplier-name').value.trim();
                        if (!newSupName) {
                            showToast('Please specify company name.', 'error');
                            return;
                        }
                        assignedSupplierId = 'sup-' + Date.now();
                        DB.suppliers.push({
                            id: assignedSupplierId,
                            name: newSupName,
                            contact: name,
                            email: email,
                            phone: 'Pending',
                            category: 'General Supplier'
                        });
                    } else {
                        assignedSupplierId = supSelectVal;
                    }
                } else {
                    dept = document.getElementById('auth-dept').value;
                }

                const newUser = {
                    id: 'usr-' + Date.now(),
                    username,
                    password,
                    name,
                    email,
                    department: dept,
                    role: accountType === 'Supplier' ? 'Supplier' : 'Employee',
                    supplierId: assignedSupplierId,
                    status: 'Pending Verification',
                    requestedPosition: accountType === 'Supplier' ? 'Supplier' : (document.getElementById('auth-requested-position')?.value || 'Employee')
                };

                DB.users.push(newUser);
                logAudit('User Registration', `Account creation requested for ${name} (${username}). Role: ${newUser.role}`);
                Storage.save(DB);

                showToast('Registration submitted! Awaiting Admin approval.', 'success');
                ui.authMode = 'login';
                renderApp();
            } else {
                const user = DB.users.find(u => u.username === username && u.password === password);
                if (!user) {
                    showToast('Invalid credentials provided.', 'error');
                    return;
                }

                if (user.status === 'Pending Verification') {
                    showToast('Your account is awaiting Admin authorization.', 'warning');
                    return;
                }

                DB.currentUser = user;
                logAudit('User Login', `User ${user.name} signed in successfully.`);
                Storage.save(DB);
                showToast(`Welcome back, ${user.name}!`, 'success');
                renderApp();
            }
        });
    }
}
