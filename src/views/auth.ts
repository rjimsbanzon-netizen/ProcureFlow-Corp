// @ts-nocheck
import { CLOUD_API_BASE } from '../services/cloud';
import { DB, ui } from '../store/state';
import procureflowMark from '../procureflow-mark.png';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderAuthScreen() {
    const isSignup = ui.authMode === 'signup';
    return `
        <div class="enterprise-auth min-h-screen flex items-center justify-center p-4">
            <div class="enterprise-auth-card max-w-md w-full rounded-2xl shadow-2xl p-8 border border-slate-200">
                <div class="text-center mb-6">
                    <div class="auth-monogram">
                        <img src="${procureflowMark}" alt="ProcureFlow Mark" class="w-16 h-16 mx-auto">
                    </div>
                    <h2 class="text-2xl font-bold text-slate-900">${isSignup ? 'Create Account' : 'Procurement Portal'}</h2>
                    <p class="text-xs text-slate-500 mt-1">Enterprise Resource Planning & Vendor Network</p>
                </div>

                <form id="auth-form" class="space-y-4">
                    ${isSignup ? `
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Account Type</label>
                            <select id="auth-account-type" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-semibold text-slate-700 bg-slate-50">
                                <option value="Employee">Internal Staff / Employee</option>
                                <option value="Supplier">External Supplier / Vendor</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Full Name / Primary Contact</label>
                            <input type="text" id="auth-name" required maxlength="120" placeholder="e.g. Jane Smith" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Email Address</label>
                            <input type="email" id="auth-email" required maxlength="254" placeholder="e.g. jane@company.com" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                        </div>
                        <div id="dept-field-container">
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Department</label>
                            <select id="auth-dept" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                                <option value="IT Systems">IT Systems</option>
                                <option value="Human Resources">Human Resources</option>
                                <option value="Procurement">Procurement</option>
                                <option value="Finance & Accounting">Finance & Accounting</option>
                                <option value="Operations">Operations</option>
                            </select>
                        </div>
                        <div id="position-field-container">
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Requested Position</label>
                            <select id="auth-requested-position" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm">
                                <option value="Employee">Employee</option>
                                <option value="Officer">Officer</option>
                                <option value="Head">Head</option>
                            </select>
                            <p class="mt-1 text-xs text-slate-500">This is a position request, not immediate access. Admin verifies your account and formally appoints Heads and Officers.</p>
                        </div>
                        <div id="supplier-select-container" class="hidden">
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Select Supplier Organization</label>
                            <select id="auth-supplier-id" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                                ${DB.suppliers.map(s => `<option value="${s.id}">${s.name} (${s.category})</option>`).join('')}
                                <option value="NEW_SUPPLIER">+ Register New Supplier Company</option>
                            </select>
                        </div>
                        <div id="new-supplier-name-container" class="hidden">
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">New Supplier Company Name</label>
                            <input type="text" id="auth-new-supplier-name" placeholder="e.g. Acme Tech Solutions" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                        </div>
                        ${CLOUD_API_BASE ? `
                            <div id="cloud-supplier-company-container" class="hidden">
                                <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Supplier Company Name</label>
                                <input type="text" id="auth-supplier-company" maxlength="160" placeholder="e.g. Acme Tech Solutions" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                            </div>
                        ` : ''}
                    ` : ''}

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Username</label>
                        <input type="text" id="auth-username" required ${isSignup ? 'minlength="3" maxlength="32" pattern="(?:[A-Za-z0-9._]|-){3,32}" title="Use 3–32 letters, numbers, periods, underscores, or hyphens."' : ''} placeholder="Enter your username" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Password</label>
                        <input type="password" id="auth-password" required ${isSignup ? 'minlength="8" maxlength="256" title="Use a password with at least 8 characters."' : ''} placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                        ${isSignup ? '<p class="mt-1 text-xs text-slate-500">Password must be 8–256 characters. Use a unique password; common passwords are not recommended.</p>' : ''}
                    </div>

                    ${isSignup ? `
                        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                            <i class="fa-solid fa-shield-halved mr-1"></i>
                            New user accounts require Admin verification. If your request was rejected by mistake, resubmit with the same username, email, and password.
                        </div>
                    ` : ''}

                    <button type="submit" class="pf-primary-action w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold text-sm shadow-md transition-colors flex items-center justify-center space-x-2">
                        <span>${isSignup ? 'Register Account' : 'Secure Sign In'}</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                </form>

                <div class="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
                    ${isSignup ? `
                        Already registered? <a href="#" id="toggle-auth" class="text-sky-600 font-semibold hover:underline">Sign In Here</a>
                    ` : `
                        Need an internal or supplier account? <a href="#" id="toggle-auth" class="text-sky-600 font-semibold hover:underline">Register Account</a>
                    `}
                </div>
            </div>
        </div>
    `;
}
