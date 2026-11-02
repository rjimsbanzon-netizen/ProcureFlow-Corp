// @ts-nocheck
import { unitLabel, displayUnit, isQuantityUnit, measurementUnitOptionsHtml } from '../domain/measurementUnits';
import { requestInput } from '../services/actionDialogs';
import { respondToAmendment } from '../actions/amendmentActions';
import { cancelProposalMeeting, canRequestMeetingReschedule, canReviewMeetingReschedule, canRescheduleProposalMeeting } from '../actions/biddingActions';
import { DEFAULT_MEETING_DURATION_MINUTES, escapeMeetingText, findMeetingConflicts, meetingDuration } from '../domain/meetingSchedule';
import { closeModal } from '../actions/modalActions';
import { renderApp } from '../core/renderBridge';
import { financeAPI } from '../services/finance';
import { canManageBidding, canManageDeliveryIssues, getAgreementFinalizationError, hasPermission } from '../domain/permissions';
import { getAvailableRequisitions, getRemainingOrderQuantity, isOrderFullyVerified } from '../domain/procurement';
import { isPhysicalPurchase } from '../domain/procurementClassification';
import { logAudit } from '../services/audit';
import { CLOUD_API_BASE, CLOUD_RECORD_COLLECTIONS, CLOUD_TOKEN_KEY, CLOUD_USERNAME_KEY, cloudRequest } from '../services/cloud';
import { submitSecureBid } from '../services/sourcing';
import { validateSupplierQuotationTerms, type SupplierQuotationTerms } from '../domain/bidTerms';
import { Storage } from '../services/storage';
import { showToast } from '../services/toast';
import { DB, ui } from '../store/state';
import { navigateTo } from '../core/renderBridge';

// Migrated from enterprise.html. Business rules / markup preserved.
export function attachMainEvents() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && logoutBtn.dataset.pfMainBound !== 'true') {
        logoutBtn.dataset.pfMainBound = 'true';
        logoutBtn.addEventListener('click', async () => {
            const token = localStorage.getItem(CLOUD_TOKEN_KEY);
            logAudit('User Logout', `User ${DB.currentUser.name} logged out.`);
            try {
                await Storage.flush();
            } catch {
                // The save failure is reported by Storage.save; continue signing out.
            }
            if (CLOUD_API_BASE && token) {
                try {
                    await cloudRequest('/auth/logout', { method: 'POST' }, token);
                } catch (error) {
                    console.error('Cloud sign-out could not invalidate the session.', error);
                    showToast('Could not invalidate the cloud session; it will expire automatically.', 'warning');
                }
                localStorage.removeItem(CLOUD_TOKEN_KEY);
                localStorage.removeItem(CLOUD_USERNAME_KEY);
            }
            DB.currentUser = null;
            Storage.save(DB);
            renderApp();
        });
    }

    const resetBtn = document.getElementById('reset-db-btn');
    if (resetBtn && resetBtn.dataset.pfMainBound !== 'true') {
        resetBtn.dataset.pfMainBound = 'true';
        resetBtn.addEventListener('click', async () => {
            if (DB.currentUser?.role !== 'Admin') {
                showToast('Only Admin can reset procurement records.', 'error');
                return;
            }
            const confirmation = await requestInput({
                title: 'Reset Procurement Workspace',
                message: 'ADMIN ONLY: Clear requisitions, orders, approvals, supplier invoices, activity history, and old notification read receipts? User accounts, uploaded documents and Finance settings remain. This cannot be undone without a backup.',
                label: 'Type RESET to confirm', exactMatch: 'RESET', required: true,
                tone: 'danger', confirmText: 'Reset workspace'
            });
            if (confirmation === null) return;
            if (confirmation !== 'RESET') {
                showToast('Reset cancelled: enter RESET exactly to confirm.', 'warning');
                return;
            }
            try {
                await Storage.reset();
            } catch (error) {
                showToast(error instanceof Error ? error.message : 'Cloud reset failed. No records were cleared locally.', 'error');
            }
        });
    }

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const tab = e.currentTarget.getAttribute('data-tab');
            ui.currentTab = tab;
            renderApp();
        });
    });

    const quickCreatePr = document.getElementById('quick-create-pr-btn');
    if (quickCreatePr) {
        quickCreatePr.addEventListener('click', () => {
            ui.currentModal = 'create_pr';
            renderApp();
        });
    }

    const openPrModalBtn = document.getElementById('open-create-pr-modal');
    if (openPrModalBtn) {
        openPrModalBtn.addEventListener('click', () => {
            ui.currentModal = 'create_pr';
            renderApp();
        });
    }

    const needRequestSelect = document.getElementById('sn-pr-id');
    if (needRequestSelect) {
        needRequestSelect.addEventListener('change', () => {
            const pr = getAvailableRequisitions().find(item => item.id === needRequestSelect.value);
            document.getElementById('sn-title').value = pr?.itemTitle || '';
            document.getElementById('sn-qty').value = pr?.quantity || '';
            const snUnit = document.getElementById('sn-unit') as HTMLInputElement | null;
            if (snUnit) snUnit.value = pr?.unit || 'units';
            const snQtyLabel = document.getElementById('sn-qty-label');
            if (snQtyLabel) snQtyLabel.textContent = `Target Quantity (${displayUnit(pr?.unit)})`;
            document.getElementById('sn-budget').value = pr?.totalCost || '';
            document.getElementById('sn-specs').value = pr?.specs || '';
        });
    }

    // Star Rating Picker
    const starPicker = document.getElementById('star-picker');
    if (starPicker) {
        const stars = starPicker.querySelectorAll('i');
        const ratingInput = document.getElementById('rating-value');
        stars.forEach((star, idx) => {
            star.addEventListener('click', () => {
                const score = idx + 1;
                ratingInput.value = score;
                stars.forEach((s, i) => {
                    if (i < score) {
                        s.className = 'fa-solid fa-star text-amber-400';
                    } else {
                        s.className = 'fa-regular fa-star text-slate-300';
                    }
                });
            });
        });
    }

    document.querySelectorAll('form[data-amendment-response-form]').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const amendmentId = form.getAttribute('data-amendment-response-form');
            const response = form.querySelector('[data-amendment-response]').value;
            respondToAmendment(amendmentId, response);
        });
    });

    // Searchable units on the legacy PR modal. Select a result to save its stable code.
    const unitSearch = document.getElementById('pr-unit-search') as HTMLInputElement | null;
    const unitSelect = document.getElementById('pr-unit') as HTMLSelectElement | null;
    const updateUnitLabels = () => {
        const unit = displayUnit(unitSelect?.value);
        const qtyLabel = document.getElementById('pr-qty-label');
        const priceLabel = document.getElementById('pr-price-label');
        if (qtyLabel) qtyLabel.textContent = `Quantity (${unit})`;
        if (priceLabel) priceLabel.textContent = `Est. Price (₱ per ${unit})`;
    };
    unitSelect?.addEventListener('change', updateUnitLabels);
    updateUnitLabels();
    if (unitSearch && unitSelect) {
        const allUnits = measurementUnitOptionsHtml();
        const filterUnits = () => {
            const previous = unitSelect.value;
            const filtered = measurementUnitOptionsHtml(unitSearch.value);
            unitSelect.innerHTML = '<option value="" disabled>Choose a matching unit…</option>' + (filtered || '<option value="" disabled>No matching units</option>');
            unitSelect.value = [...unitSelect.options].some(option => option.value === previous && option.value !== '') ? previous : '';
        };
        unitSearch.addEventListener('input', filterUnits);
        unitSearch.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault(); // Do not accidentally submit the requisition.
            const first = [...unitSelect.options].find(option => option.value && !option.disabled);
            if (first) {
                unitSelect.value = first.value;
                unitSearch.value = '';
                unitSelect.innerHTML = allUnits;
                unitSelect.value = first.value;
                unitSelect.focus();
            }
        });
        unitSelect.addEventListener('change', () => {
            const selected = unitSelect.value;
            unitSearch.value = '';
            unitSelect.innerHTML = allUnits;
            unitSelect.value = selected;
        });
    }

    // Forms Submit Events
    const createPrForm = document.getElementById('create-pr-form');
    if (createPrForm) {
        createPrForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('pr-title').value.trim();
            const specs = document.getElementById('pr-specs').value.trim();
            const qty = Number(document.getElementById('pr-qty').value);
            if(!Number.isInteger(qty)||qty<1){
                showToast('Enter a whole-number quantity of at least 1 and select its measurement unit.', 'error');
                return;
            }
            const selectedUnit = (document.getElementById('pr-unit') as HTMLSelectElement)?.value;
            if (!isQuantityUnit(selectedUnit)) {
                showToast('Choose a valid unit of measurement.', 'error');
                return;
            }
            const unit = unitLabel(selectedUnit);
            const price = parseFloat(document.getElementById('pr-price').value);
            const targetDate = document.getElementById('pr-date').value;
            const remarks = document.getElementById('pr-remarks').value.trim();

            const newPR = {
                id: 'PR-' + (1000 + DB.requisitions.length + 1),
                department: DB.currentUser.department,
                itemTitle: title,
                specs: specs,
                targetDate: targetDate,
                unitPrice: price,
                quantity: qty,
                unit,
                totalCost: qty * price,
                status: 'Pending',
                requestedBy: DB.currentUser.name,
                requestedByUsername: DB.currentUser.username,
                createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                remarks: remarks
            };

            DB.requisitions.unshift(newPR);
            logAudit('PR Created', `Requisition ${newPR.id} created for ${title}.`);
            Storage.save(DB);
            closeModal();
            if (CLOUD_API_BASE) {
                // Save the PR to the shared snapshot before initiating its D1 approval workflow.
                // Only the assigned Department Head (or Admin) is permitted to submit it.
                try {
                    await Storage.flush();
                    await financeAPI.start(newPR.id);
                    showToast(`${newPR.id} submitted to Procurement Head for review.`, 'success');
                } catch (error) {
                    showToast(`PR ${newPR.id} saved, but workflow not started: ${error instanceof Error ? error.message : String(error)}. An assigned Department Head may submit it from Approvals.`, 'warning');
                }
                navigateTo('approvals');
            } else {
                showToast(`Requisition ${newPR.id} created successfully!`, 'success');
            }
        });
    }

    const recordDeliveryForm = document.getElementById('record-delivery-form');
    if (recordDeliveryForm) {
        recordDeliveryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const order = DB.orders.find(o => o.id === ui.selectedRecord);
            const qtyDelivered = parseInt(document.getElementById('del-qty').value);
            const delDate = document.getElementById('del-date').value;
            const notes = document.getElementById('del-notes').value.trim();
            const remainingQty = getRemainingOrderQuantity(order?.id);

            if (hasPermission('record_delivery') && order &&
                ['Approved & Signed', 'Issued'].includes(order.status) &&
                Number.isInteger(qtyDelivered) && qtyDelivered > 0 && qtyDelivered <= remainingQty && delDate) {
                const newDel = {
                    id: 'DEL-' + (8000 + DB.deliveries.length + 1),
                    poId: order.id,
                    prId: order.prId,
                    supplierName: order.supplierName,
                    department: order.department,
                    itemTitle: order.itemTitle,
                    specs: order.specs,
                    orderedQty: order.quantity,
                    deliveredQty: qtyDelivered,
                    unit: order.unit || 'units',
                    purchaseCategory: order.purchaseCategory || 'Goods & Materials',
                    // Expected date comes from the approved requisition / PO, never the actual delivery date.
                    expectedDate: order.expectedDate || DB.requisitions.find(pr => pr.id === order.prId)?.targetDate || '',
                    actualDate: delDate,
                    deliveryStatus: qtyDelivered === remainingQty ? 'Delivered' : 'Partial',
                    complianceStatus: 'Pending Inspection',
                    remarks: notes,
                    recordedBy: DB.currentUser.name,
                    updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
                };

                DB.deliveries.unshift(newDel);
                const payment = DB.payments.find(item => item.poId === order.id);
                if (payment) payment.deliveryVerified = false;
                logAudit('Delivery Recorded', `${isPhysicalPurchase(order.purchaseCategory) ? 'Shipment' : 'Service completion'} recorded for PO ${order.id}. Qty: ${qtyDelivered} ${displayUnit(order.unit)}`);
                Storage.save(DB);
                showToast(`${isPhysicalPurchase(order.purchaseCategory) ? 'Delivery' : 'Completion'} logged for ${order.id}.`, 'success');
                closeModal();
            } else {
                showToast('Delivery could not be recorded. Verify PO acceptance and remaining ordered quantity.', 'error');
            }
        });
    }

    const inspectDeliveryForm = document.getElementById('inspect-delivery-form');
    if (inspectDeliveryForm) {
        inspectDeliveryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const delivery = DB.deliveries.find(d => d.id === ui.selectedRecord);
            const inspectStatus = document.getElementById('inspect-status').value;
            const remarks = document.getElementById('inspect-remarks').value.trim();

            if (delivery) {
                delivery.complianceStatus = inspectStatus;
                delivery.remarks += ` | Inspection: ${remarks}`;

                const payment = DB.payments.find(p => p.poId === delivery.poId);
                if (payment) payment.deliveryVerified = isOrderFullyVerified(delivery.poId);

                logAudit('Delivery Inspected', `Delivery ${delivery.id} marked as ${inspectStatus}`);
                Storage.save(DB);
                if (CLOUD_API_BASE) {
                    // Reconcile accepted stock after the delivery inspection is safely cloud-saved.
                    void Storage.flush().then(() => cloudRequest('/operations/inventory/sync', { method: 'POST', body: '{}' }))
                        .catch(error => showToast(`Inventory sync pending: ${error instanceof Error ? error.message : String(error)}`, 'warning'));
                }
                showToast(`Inspection outcome logged successfully!`, 'success');
                closeModal();
            } else {
                showToast('The delivery record could not be found.', 'error');
            }
        });
    }

    const rateSupplierForm = document.getElementById('rate-supplier-form');
    if (rateSupplierForm) {
        rateSupplierForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const ratingVal = parseInt(document.getElementById('rating-value').value);
            const qScore = parseInt(document.getElementById('score-quality').value);
            const dScore = parseInt(document.getElementById('score-delivery').value);
            const pScore = parseInt(document.getElementById('score-pricing').value);
            const feedback = document.getElementById('rating-feedback').value.trim();
            const supplierId = typeof ui.selectedRecord === 'object' ? ui.selectedRecord.supplierId : null;
            const poId = typeof ui.selectedRecord === 'object' ? ui.selectedRecord.poId : null;
            const payment = DB.payments.find(item => item.poId === poId);
            const order = DB.orders.find(item => item.id === poId && item.supplierId === supplierId);

            if (!hasPermission('rate_supplier') || !payment || payment.status !== 'Paid' || !order ||
                !isOrderFullyVerified(poId) || DB.ratings.some(item => item.poId === poId) ||
                !Number.isInteger(ratingVal) || ratingVal < 1 || ratingVal > 5 ||
                !Number.isInteger(qScore) || qScore < 1 || qScore > 5 ||
                !Number.isInteger(dScore) || dScore < 1 || dScore > 5 ||
                !Number.isInteger(pScore) || pScore < 1 || pScore > 5 || !feedback) {
                showToast('A valid evaluation can be submitted only for a completed and paid transaction.', 'error');
                return;
            }
            const newRating = {
                id: 'rat-' + Date.now(),
                supplierId,
                poId,
                evaluatorName: DB.currentUser.name,
                evaluatorRole: DB.currentUser.role,
                rating: ratingVal,
                qualityScore: qScore,
                deliveryScore: dScore,
                pricingScore: pScore,
                feedback: feedback,
                createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
            };

            DB.ratings.unshift(newRating);
            logAudit('Supplier Evaluated', `Rating submitted for supplier ${supplierId} after transaction ${poId}.`);
            Storage.save(DB);
            showToast('Supplier evaluation recorded.', 'success');
            closeModal();
        });
    }

    const addSupplierForm = document.getElementById('add-supplier-form');
    if (addSupplierForm) {
        addSupplierForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('sup-name').value.trim();
            const contact = document.getElementById('sup-contact').value.trim();
            const email = document.getElementById('sup-email').value.trim();
            const phone = document.getElementById('sup-phone').value.trim();
            const category = document.getElementById('sup-category').value.trim();

            const newSup = {
                id: 'sup-' + Date.now(),
                name,
                contact,
                email,
                phone,
                category
            };

            DB.suppliers.push(newSup);
            logAudit('Supplier Added', `Vendor ${name} registered into vendor system.`);
            Storage.save(DB);
            showToast(`Supplier ${name} added successfully!`, 'success');
            closeModal();
        });
    }

    const processPaymentForm = document.getElementById('process-payment-form');
    if (processPaymentForm) {
        processPaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payment = DB.payments.find(p => p.id === ui.selectedRecord);
            const method = document.getElementById('pay-method').value;
            const ref = document.getElementById('pay-ref').value.trim();

            // Cloud payments are authorized per PO by /finance/payment-authority.
            // Do not block an approved acting Finance Officer/Head using the
            // permanent-role matrix; the Worker also validates the final write.
            const locallyPermitted = hasPermission('process_payment');
            const mayAttempt = CLOUD_API_BASE ? DB.currentUser?.role !== 'Supplier' : locallyPermitted;
            if (mayAttempt && payment && payment.status === 'Pending' &&
                isOrderFullyVerified(payment.poId) && method && ref) {
                // Verify against the server immediately before changing any payment record.
                if (CLOUD_API_BASE) {
                    try {
                        await Storage.flush();
                        const authorization = await financeAPI.paymentAuthority(payment.poId);
                        if (!authorization.allowed) {
                            showToast(authorization.reason || `Only the assigned ${authorization.requiredRole} may process this payment.`, 'error');
                            return;
                        }
                        const matching = await financeAPI.matchStatus(payment.poId);
                        if (!matching.matched) {
                            showToast('Cannot disburse: ' + matching.reasons.join(' '), 'error');
                            return;
                        }
                    } catch (error) {
                        showToast(error instanceof Error ? error.message : 'Invoice match verification failed.', 'error');
                        return;
                    }
                }
                const previous = { ...payment };
                const auditRecord = {
                    id: 'log-' + crypto.randomUUID(),
                    timestamp: new Date().toISOString().replace('T',' ').substring(0,16),
                    user: DB.currentUser.name,
                    role: DB.currentUser.role,
                    action: 'Disbursement Completed',
                    details: `Payment ${payment.id} processed via ${method}. Ref: ${ref}`
                };
                payment.paymentMethod = method;
                payment.refNumber = ref;
                payment.status = 'Paid';
                payment.paymentDate = new Date().toISOString().substring(0, 10);
                payment.processedBy = DB.currentUser.name;
                DB.auditLogs.unshift(auditRecord);
                try {
                    Storage.save(DB);
                    await Storage.flush();
                    showToast(`Disbursement of ₱${payment.paymentAmount.toLocaleString()} confirmed!`, 'success');
                    closeModal();
                } catch (error) {
                    Object.assign(payment, previous);
                    DB.auditLogs = DB.auditLogs.filter(item => item.id !== auditRecord.id);
                    // Restore the local demo snapshot without issuing a second cloud write.
                    localStorage.setItem('eprocurement_db', JSON.stringify(DB));
                    showToast(error instanceof Error ? `Payment not saved: ${error.message}` : 'Payment was not saved.', 'error');
                    renderApp();
                }
            } else {
                showToast('Payment is blocked until every item is received and verified.', 'error');
            }
        });
    }

    const initiateAmendmentForm = document.getElementById('initiate-amendment-form');
    if (initiateAmendmentForm) {
        initiateAmendmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reason = document.getElementById('amend-reason').value.trim();
            const qty = parseInt(document.getElementById('amend-qty').value);
            const specs = document.getElementById('amend-specs').value.trim();
            const order = DB.orders.find(item => item.id === ui.selectedRecord.poId);
            const delivery = DB.deliveries.find(item => item.id === ui.selectedRecord.delId && item.poId === ui.selectedRecord.poId);

            if (!canManageDeliveryIssues() || !order || !delivery ||
                !Number.isInteger(qty) || qty < 1 || !reason || !specs) {
                showToast('Amendment details are invalid or the delivery issue is no longer actionable.', 'error');
                return;
            }
            const newAmd = {
                id: 'AMD-' + (3000 + DB.amendments.length + 1),
                poId: ui.selectedRecord.poId,
                delId: ui.selectedRecord.delId,
                supplierId: order.supplierId,
                supplierName: order.supplierName,
                reason: reason,
                revisedQty: qty,
                revisedSpecs: specs,
                approvalStatus: 'Pending Supplier Response',
                requestedBy: DB.currentUser.name
            };

            DB.amendments.unshift(newAmd);
            logAudit('Amendment Issued', `Amendment ${newAmd.id} issued to ${order.supplierName} for PO ${ui.selectedRecord.poId}.`);
            Storage.save(DB);
            showToast('Order amendment issued; awaiting the supplier explanation.', 'success');
            closeModal();
        });
    }

    const createStockNeedForm = document.getElementById('create-stock-need-form');
    if (createStockNeedForm) {
        createStockNeedForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const prId = document.getElementById('sn-pr-id').value;
            const pr = getAvailableRequisitions().find(item => item.id === prId);
            const title = document.getElementById('sn-title').value.trim();
            const targetQty = parseInt(document.getElementById('sn-qty').value);
            const budgetCap = parseFloat(document.getElementById('sn-budget').value);
            const techSpecs = document.getElementById('sn-specs').value.trim();

            if (!canManageBidding() || !pr || !title || !techSpecs ||
                !Number.isInteger(targetQty) || targetQty < 1 ||
                !Number.isFinite(budgetCap) || budgetCap < 0) {
                showToast('A published need must be based on an approved request with valid details.', 'error');
                return;
            }

            const newNeed = {
                id: 'SN-' + (2000 + DB.stockNeeds.length + 1),
                prId: pr.id,
                title,
                targetQty,
                unit: pr?.unit || 'units',
                budgetCap,
                techSpecs,
                status: 'Published',
                createdBy: DB.currentUser.name,
                createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
            };

            DB.stockNeeds.unshift(newNeed);
            logAudit('Stock Need Published', `Stock Need ${newNeed.id} published by ${DB.currentUser.name}`);
            Storage.save(DB);
            showToast(`Stock Need ${newNeed.id} published for bidding!`, 'success');
            closeModal();
        });
    }

    const submitBidForm = document.getElementById('submit-bid-form');
    if (submitBidForm) {
        const unitPriceInput = document.getElementById('bid-unit-price');
        const totalPreview = document.getElementById('bid-total-preview');
        const need = DB.stockNeeds.find(s => s.id === ui.selectedRecord);
        unitPriceInput.addEventListener('input', () => {
            const unitPrice = Number(unitPriceInput.value);
            totalPreview.textContent = Number.isFinite(unitPrice) && unitPrice >= 0
                ? `₱${(unitPrice * (need?.targetQty || 0)).toLocaleString()}`
                : 'Enter a valid unit price';
        });
        submitBidForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const supplier = DB.suppliers.find(s => s.id === DB.currentUser.supplierId);
            const unitPrice = Number(document.getElementById('bid-unit-price').value);
            const leadTimeDays = Number(document.getElementById('bid-lead-time').value);
            const notes = document.getElementById('bid-notes').value.trim();
            const field = id => document.getElementById(id).value.trim();
            const numberField = id => field(id) === '' ? NaN : Number(field(id));
            const quotationTerms: SupplierQuotationTerms = {
                version: 1,
                offeredModel: field('bid-offered-model'),
                specificationClaim: field('bid-specification-claim'),
                specificationExceptions: field('bid-specification-exceptions'),
                deliveryCommitment: field('bid-delivery-commitment'),
                warrantyMonths: numberField('bid-warranty-months'),
                warrantyCoverage: field('bid-warranty-coverage'),
                warrantyService: field('bid-warranty-service'),
                replacementDays: numberField('bid-replacement-days'),
                paymentCondition: field('bid-payment-condition'),
                validityDays: numberField('bid-validity-days'),
                afterSalesSupport: field('bid-after-sales-support'),
                supportingReference: field('bid-supporting-reference'),
                additionalClauses: field('bid-additional-clauses'),
                supplierDeclaration: document.getElementById('bid-terms-confirm').checked
            };

            if (DB.currentUser.role !== 'Supplier') {
                showToast('Only supplier accounts can submit bids.', 'error');
                return;
            }
            if (!need || need.status !== 'Published') {
                showToast('This procurement need is no longer open for bidding.', 'error');
                return;
            }
            if (!supplier) {
                showToast('Your account is missing its supplier profile. Contact Admin to link your company profile.', 'error');
                return;
            }
            if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
                showToast('Enter a valid offered unit price in Philippine pesos.', 'error');
                return;
            }
            if (!Number.isInteger(leadTimeDays) || leadTimeDays <= 0 || leadTimeDays > 365) {
                showToast('Enter a valid delivery lead time in whole days.', 'error');
                return;
            }
            const termsError = validateSupplierQuotationTerms(quotationTerms);
            if (termsError) {
                showToast(termsError, 'error');
                return;
            }

            // The browser is NOT an authority for submitted bids. Use the secured
            // endpoint and wait for the Worker to confirm the transaction. In
            // particular, never create a BID-* record locally and send it through
            // /enterprise-state (the Worker deliberately rejects that route).
            const submitButton = submitBidForm.querySelector('button[type="submit"]');
            if (submitButton?.disabled) return;
            const originalLabel = submitButton?.textContent;
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting securely…';
            }
            try {
                if (!CLOUD_API_BASE || !localStorage.getItem(CLOUD_TOKEN_KEY)) {
                    throw new Error('Please sign in to the connected procurement portal to submit a quotation.');
                }

                // Drain previous writes before the secured POST. Old client
                // versions may have queued a forbidden local bid creation; that
                // known error must not block retrying the *correct* API.
                try {
                    await Storage.flush();
                } catch (syncError) {
                    const reason = syncError instanceof Error ? syncError.message : String(syncError);
                    if (!reason.includes('New bids must use the secured /sourcing/bids endpoint')) {
                        throw new Error(`Other workspace changes failed to synchronize: ${reason}`);
                    }
                }

                // A green "Bid Submitted" card may be a legacy optimistic local
                // record. Check D1, not DB.bids, before disallowing duplicates.
                const before = await cloudRequest('/enterprise-state');
                const cloudBids = before?.data?.bids;
                if (!Array.isArray(cloudBids)) {
                    throw new Error('Could not confirm existing bids from the server. Please refresh and try again.');
                }
                const alreadySubmitted = cloudBids.find(item => item.needId === need.id &&
                    (item.supplierId === supplier.id ||
                     String(item.supplierName || '').toLowerCase() === String(supplier.name || '').toLowerCase()));
                if (alreadySubmitted) {
                    DB.bids = cloudBids;
                    localStorage.setItem('eprocurement_db', JSON.stringify(DB));
                    closeModal();
                    showToast(`Your company's bid ${alreadySubmitted.id} is already saved for ${need.title}.`, 'info');
                    return;
                }

                const { bid: savedBid } = await submitSecureBid({
                    needId: need.id,
                    unitPrice,
                    leadTimeDays,
                    notes: notes || quotationTerms.offeredModel,
                    quotationTerms
                });
                if (!savedBid || !savedBid.id || savedBid.needId !== need.id) {
                    throw new Error('The server did not return a confirmed bid. Refresh and check your submissions.');
                }

                // Once POST succeeds, use the server-generated bid ID. Keep the
                // latest server data in memory WITHOUT triggering another PUT.
                DB.bids = [savedBid, ...DB.bids.filter(item => item.id !== savedBid.id &&
                    !(item.needId === savedBid.needId && item.supplierId === savedBid.supplierId))];
                try {
                    const after = await cloudRequest('/enterprise-state');
                    if (Array.isArray(after?.data?.bids) &&
                        after.data.bids.some(item => item.id === savedBid.id)) {
                        for (const collection of CLOUD_RECORD_COLLECTIONS) {
                            if (Array.isArray(after.data[collection])) DB[collection] = after.data[collection];
                        }
                    }
                } catch (refreshError) {
                    console.warn('Bid was confirmed, but the workspace refresh failed.', refreshError);
                }
                localStorage.setItem('eprocurement_db', JSON.stringify(DB));
                closeModal();
                showToast(`Bid ${savedBid.id} submitted and confirmed for ${need.title}!`, 'success');
            } catch (submitError) {
                const reason = submitError instanceof Error ? submitError.message : String(submitError);
                showToast(`Bid not confirmed: ${reason}`, 'error');
            } finally {
                if (submitButton?.isConnected) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalLabel || 'Submit Quotation & Clauses';
                }
            }
        });
    }

    const scheduleMeetingForm = document.getElementById('schedule-meeting-form');
    if (scheduleMeetingForm) {
        const getSlot = () => ({
            date: document.getElementById('mtg-date').value,
            time: document.getElementById('mtg-time').value,
            durationMinutes: Number(document.getElementById('mtg-duration').value) || DEFAULT_MEETING_DURATION_MINUTES
        });
        const updateConflictWarning = () => {
            const slot = getSlot();
            const warning = document.getElementById('mtg-conflict-warning');
            const submit = document.getElementById('mtg-submit');
            const conflicts = slot.date && slot.time
                ? findMeetingConflicts(slot, DB.proposalMeetings)
                : [];
            if (warning) {
                warning.classList.toggle('hidden', conflicts.length === 0);
                warning.innerHTML = conflicts.length
                    ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i> <b>Overlapping schedule!</b> This time conflicts with ${conflicts.map(m => `${escapeMeetingText(m.id)} (${escapeMeetingText(m.time)}, ${meetingDuration(m.durationMinutes)} min)`).join(', ')}. Choose another slot or cancel an existing meeting.`
                    : '';
            }
            if (submit) submit.disabled = conflicts.length > 0;
            if (submit) submit.classList.toggle('opacity-50', conflicts.length > 0);
        };
        ['mtg-date', 'mtg-time', 'mtg-duration'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', updateConflictWarning);
            document.getElementById(id)?.addEventListener('change', updateConflictWarning);
        });
        updateConflictWarning();
        scheduleMeetingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const bid = DB.bids.find(b => b.id === ui.selectedRecord);
            const { date, time, durationMinutes } = getSlot();
            const meetingMode = document.getElementById('mtg-mode').value;
            const venue = document.getElementById('mtg-venue').value.trim();
            const notes = document.getElementById('mtg-notes').value.trim();
            const need = DB.stockNeeds.find(item => item.id === bid?.needId);
            const activeMeetingForBid = DB.proposalMeetings.some(item =>
                item.bidId === bid?.id && ['Pending Response', 'Agreed'].includes(item.status));

            // Validate again on submit: disabling a button is not a security boundary.
            if (findMeetingConflicts({ date, time, durationMinutes }, DB.proposalMeetings).length) {
                updateConflictWarning();
                showToast('This meeting overlaps an existing schedule. Choose another time.', 'warning');
                return;
            }
            if (new Date(`${date}T${time}:00`).getTime() <= Date.now()) {
                showToast('Select a future date and time for the proposal meeting.', 'warning');
                return;
            }
            if (![30, 60, 90, 120].includes(durationMinutes)) {
                showToast('Select a valid meeting duration.', 'error');
                return;
            }
            if (canManageBidding() && bid?.status === 'Selected' && need?.selectedBidId === bid.id &&
                ['Supplier Selected', 'Published'].includes(need.status) &&
                !activeMeetingForBid && !DB.orders.some(order => order.bidId === bid?.id) &&
                date && time && meetingMode && venue) {
                const nextSerial = DB.proposalMeetings.reduce((max, m) => {
                    const match = /^MTG-(\d+)$/.exec(m.id);
                    return match ? Math.max(max, Number(match[1])) : max;
                }, 4000) + 1;
                const newMtg = {
                    id: 'MTG-' + nextSerial,
                    needId: bid.needId,
                    bidId: bid.id,
                    supplierId: bid.supplierId,
                    supplierName: bid.supplierName,
                    date,
                    time,
                    durationMinutes,
                    meetingMode,
                    venue,
                    status: 'Pending Response',
                    notes
                };

                DB.proposalMeetings.unshift(newMtg);
                logAudit('Proposal Meeting Scheduled', `Meeting ${newMtg.id} scheduled with ${bid.supplierName} for ${date} at ${time} (${durationMinutes} minutes)`);
                Storage.save(DB);
                showToast(`Proposal meeting scheduled with ${bid.supplierName}!`, 'success');
                closeModal();
            } else {
                showToast('The proposal meeting could not be scheduled. Verify supplier selection and meeting details.', 'error');
            }
        });
    }

    // Secured meeting endpoints already committed to the cloud; never overwrite the result with a stale PUT.
    const refreshSecuredMeeting = async (meeting) => {
        const index = DB.proposalMeetings.findIndex(m => m.id === meeting.id);
        if (index >= 0) DB.proposalMeetings[index] = meeting;
        try {
            const snapshot = await cloudRequest('/enterprise-state');
            if (snapshot?.data) {
                CLOUD_RECORD_COLLECTIONS.forEach(key => {
                    if (Array.isArray(snapshot.data[key])) DB[key] = snapshot.data[key];
                });
            }
        } catch (error) {
            console.warn('Meeting saved but workspace refresh could not complete.', error);
        }
        localStorage.setItem('eprocurement_db', JSON.stringify(DB));
    };

    // The invited supplier requests a different date/time. The current reservation stays unchanged.
    const supplierRequestForm = document.getElementById('supplier-reschedule-request-form');
    if (supplierRequestForm) {
        let saving = false;
        const meeting = DB.proposalMeetings.find(m => m.id === ui.selectedRecord);
        const readSlot = () => ({
            date: document.getElementById('supplier-reschedule-date').value,
            time: document.getElementById('supplier-reschedule-time').value,
            durationMinutes: Number(document.getElementById('supplier-reschedule-duration').value)
        });
        const checkSlot = () => {
            const slot = readSlot();
            const conflicts = slot.date && slot.time ? findMeetingConflicts(slot, DB.proposalMeetings, meeting?.id) : [];
            const warning = document.getElementById('supplier-reschedule-conflict');
            if (warning) {
                warning.classList.toggle('hidden', !conflicts.length);
                // Do not disclose other suppliers' meeting details to the requesting supplier.
                warning.textContent = conflicts.length ? 'This time is already reserved. Please choose a different date, time, or duration.' : '';
            }
            const submit = document.getElementById('supplier-reschedule-submit');
            if (submit) { submit.disabled = Boolean(conflicts.length) || saving; submit.classList.toggle('opacity-50', Boolean(conflicts.length) || saving); }
            return conflicts.length;
        };
        ['supplier-reschedule-date','supplier-reschedule-time','supplier-reschedule-duration'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', checkSlot);
            document.getElementById(id)?.addEventListener('change', checkSlot);
        });
        checkSlot();
        supplierRequestForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (saving || !meeting || !canRequestMeetingReschedule(meeting.id)) return;
            const {date,time,durationMinutes} = readSlot();
            const reason = document.getElementById('supplier-reschedule-reason').value.trim();
            if (checkSlot()) { showToast('Choose an available meeting time.', 'warning'); return; }
            if (!date || !time || !Number.isFinite(Date.parse(`${date}T${time}:00+08:00`)) ||
                Date.parse(`${date}T${time}:00+08:00`) <= Date.now()) {
                showToast('Select a valid future Philippine date and time.', 'warning'); return;
            }
            if (![30,60,90,120].includes(durationMinutes) || reason.length < 5 || reason.length > 500) {
                showToast('Choose a valid duration and enter a reason (5–500 characters).', 'error'); return;
            }
            if (meeting.date === date && meeting.time === time && meetingDuration(meeting.durationMinutes) === durationMinutes) {
                showToast('Propose a different date, time or duration.', 'warning'); return;
            }
            const payload = {date,time,durationMinutes,reason,
                expected: {date:meeting.date,time:meeting.time,status:meeting.status,rescheduleCount:meeting.rescheduleCount || 0}};
            saving = true;
            checkSlot();
            try {
                if (CLOUD_API_BASE) {
                    if (!localStorage.getItem(CLOUD_TOKEN_KEY)) throw new Error('Please sign in to send a schedule request.');
                    await Storage.flush();
                    const result = await cloudRequest(`/sourcing/meetings/${encodeURIComponent(meeting.id)}/reschedule-request`,
                        {method:'POST',body:JSON.stringify(payload)});
                    if (!result.meeting) throw new Error('The cloud did not confirm this request.');
                    await refreshSecuredMeeting(result.meeting);
                } else {
                    const requestedAt = new Date().toISOString();
                    meeting.rescheduleRequest = {date,time,durationMinutes,reason,requestedBy:DB.currentUser.name,requestedAt,status:'Pending'};
                    logAudit('Meeting Reschedule Requested', `Supplier requested rescheduling ${meeting.id} to ${date} at ${time}.`);
                    Storage.save(DB);
                }
                showToast(`Rescheduling request sent for ${meeting.id}. Await Procurement approval.`, 'success');
                closeModal();
            } catch (error) {
                showToast(error instanceof Error ? error.message : 'Could not submit the schedule change request.', 'error');
            } finally { saving = false; checkSlot(); }
        });
    }

    // Admin/Procurement Head either approve the proposed slot or decline the request.
    const reviewRequestForm = document.getElementById('review-meeting-reschedule-form');
    if (reviewRequestForm) {
        let saving = false;
        reviewRequestForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (saving) return;
            const decision = e.submitter?.value;
            const note = document.getElementById('review-reschedule-note').value.trim();
            const meeting = DB.proposalMeetings.find(m => m.id === ui.selectedRecord);
            if (!['Approve','Reject'].includes(decision) || !meeting || !canReviewMeetingReschedule(meeting.id)) {
                showToast('This supplier request is no longer awaiting review.', 'error'); return;
            }
            if (note.length > 500) { showToast('The decision note must be 500 characters or fewer.', 'error'); return; }
            const request = meeting.rescheduleRequest;
            if (decision === 'Approve' && findMeetingConflicts({date:request.date,time:request.time,
                    durationMinutes:request.durationMinutes},DB.proposalMeetings,meeting.id).length) {
                showToast('The proposed time now conflicts with another meeting. Decline the request or resolve the conflict.', 'warning'); return;
            }
            const payload = {decision,note,expected:{date:meeting.date,time:meeting.time,status:meeting.status,
                rescheduleCount:meeting.rescheduleCount || 0,requestedAt:request.requestedAt}};
            saving = true;
            const buttons = reviewRequestForm.querySelectorAll('[type="submit"]');
            buttons.forEach(button => button.disabled = true);
            try {
                if (CLOUD_API_BASE) {
                    if (!localStorage.getItem(CLOUD_TOKEN_KEY)) throw new Error('Please sign in to review the schedule request.');
                    await Storage.flush();
                    const result = await cloudRequest(`/sourcing/meetings/${encodeURIComponent(meeting.id)}/reschedule-request/decision`,
                        {method:'POST',body:JSON.stringify(payload)});
                    if (!result.meeting) throw new Error('The cloud did not confirm this decision.');
                    await refreshSecuredMeeting(result.meeting);
                } else {
                    const reviewedAt = new Date().toISOString();
                    meeting.rescheduleRequest = {...request,status:decision === 'Approve' ? 'Approved' : 'Rejected',
                        reviewedBy:DB.currentUser.name,reviewedAt,reviewNote:note};
                    if (decision === 'Approve') {
                        const previous = {date:meeting.date,time:meeting.time,durationMinutes:meetingDuration(meeting.durationMinutes),
                            meetingMode:meeting.meetingMode,venue:meeting.venue,notes:meeting.notes,status:meeting.status,
                            reason:request.reason,changedAt:reviewedAt,changedBy:DB.currentUser.name};
                        meeting.rescheduleHistory = [...(meeting.rescheduleHistory || []),previous];
                        Object.assign(meeting,{date:request.date,time:request.time,durationMinutes:request.durationMinutes,
                            status:'Pending Response',rescheduleReason:request.reason,rescheduledBy:DB.currentUser.name,
                            rescheduledAt:reviewedAt,rescheduleCount:(meeting.rescheduleCount || 0)+1});
                    }
                    logAudit(decision === 'Approve' ? 'Meeting Reschedule Approved' : 'Meeting Reschedule Rejected',
                        `${meeting.id}: ${decision} supplier reschedule request.`);
                    Storage.save(DB);
                }
                showToast(decision === 'Approve' ? 'New schedule approved. Supplier confirmation is required.' :
                    'Schedule request declined. Original meeting unchanged.', 'success');
                closeModal();
            } catch (error) {
                showToast(error instanceof Error ? error.message : 'Could not save the decision.', 'error');
            } finally { saving = false; buttons.forEach(button => button.disabled = false); }
        });
    }

    // Rescheduling updates the existing meeting reference; supplier acceptance is reset.
    const rescheduleForm = document.getElementById('reschedule-meeting-form');
    if (rescheduleForm) {
        const original = DB.proposalMeetings.find(meeting => meeting.id === ui.selectedRecord);
        const readSlot = () => ({
            date: document.getElementById('reschedule-date').value,
            time: document.getElementById('reschedule-time').value,
            durationMinutes: Number(document.getElementById('reschedule-duration').value)
        });
        const checkConflicts = () => {
            const slot = readSlot();
            const conflicts = slot.date && slot.time
                ? findMeetingConflicts(slot, DB.proposalMeetings, original?.id) : [];
            const warning = document.getElementById('reschedule-conflict-warning');
            const submit = document.getElementById('reschedule-submit');
            if (warning) {
                warning.classList.toggle('hidden', conflicts.length === 0);
                warning.innerHTML = conflicts.length ? `<div class="font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Meeting time overlaps an existing reservation</div><p class="mt-1">${conflicts.map(m => `${escapeMeetingText(m.id)} (${escapeMeetingText(m.supplierName)} — ${escapeMeetingText(m.date)} at ${escapeMeetingText(m.time)}, ${meetingDuration(m.durationMinutes)} minutes)`).join('; ')}</p><p class="mt-1">Choose a different date, start time, or duration.</p>` : '';
            }
            if (submit) {
                submit.disabled = conflicts.length > 0;
                submit.classList.toggle('opacity-50', conflicts.length > 0);
            }
            return conflicts;
        };
        ['reschedule-date', 'reschedule-time', 'reschedule-duration'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', checkConflicts);
            document.getElementById(id)?.addEventListener('change', checkConflicts);
        });
        checkConflicts();
        let isSubmitting = false;
        rescheduleForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (isSubmitting || !original) return;
            const { date, time, durationMinutes } = readSlot();
            const meetingMode = document.getElementById('reschedule-mode').value;
            const venue = document.getElementById('reschedule-venue').value.trim();
            const notes = document.getElementById('reschedule-notes').value.trim();
            const reason = document.getElementById('reschedule-reason').value.trim();
            const current = DB.proposalMeetings.find(m => m.id === original.id);
            if (!current || !canRescheduleProposalMeeting(current.id)) {
                showToast('This meeting is no longer eligible for rescheduling.', 'error'); return;
            }
            if (checkConflicts().length) {
                showToast('Choose a time that does not overlap another meeting.', 'warning'); return;
            }
            if (!date || !time || !Number.isFinite(new Date(`${date}T${time}:00`).getTime()) ||
                new Date(`${date}T${time}:00`).getTime() <= Date.now()) {
                showToast('Select a valid future meeting date and time.', 'warning'); return;
            }
            if (![30, 60, 90, 120].includes(durationMinutes) || !['Online', 'Face-to-face'].includes(meetingMode) ||
                !venue || venue.length > 500 || notes.length > 1000 || reason.length < 5 || reason.length > 500) {
                showToast('Please complete the meeting details and a reason (5–500 characters).', 'error'); return;
            }
            const hasChanged = date !== String(current.date) || time !== String(current.time) ||
                durationMinutes !== meetingDuration(current.durationMinutes) || meetingMode !== current.meetingMode ||
                venue !== String(current.venue || '') || notes !== String(current.notes || '');
            if (!hasChanged) { showToast('Change at least one meeting detail before sending an updated invitation.', 'warning'); return; }
            const payload = { date, time, durationMinutes, meetingMode, venue, notes, reason,
                expected: { date: current.date, time: current.time, status: current.status, rescheduleCount: current.rescheduleCount || 0 } };
            isSubmitting = true;
            const submit = document.getElementById('reschedule-submit');
            if (submit) { submit.disabled = true; submit.textContent = 'Saving updated schedule…'; }
            try {
                if (CLOUD_API_BASE) {
                    if (!localStorage.getItem(CLOUD_TOKEN_KEY)) throw new Error('Please sign in again before rescheduling a meeting.');
                    await Storage.flush();
                    const result = await cloudRequest(`/sourcing/meetings/${encodeURIComponent(current.id)}/reschedule`, {
                        method: 'POST', body: JSON.stringify(payload)
                    });
                    if (!result.meeting) throw new Error('The cloud did not confirm the meeting update.');
                    const index = DB.proposalMeetings.findIndex(m => m.id === current.id);
                    if (index !== -1) DB.proposalMeetings[index] = result.meeting;
                    // Read canonical state. Never PUT the old snapshot back over the new meeting.
                    try {
                        const snapshot = await cloudRequest('/enterprise-state');
                        if (snapshot?.data) {
                            CLOUD_RECORD_COLLECTIONS.forEach(key => {
                                if (Array.isArray(snapshot.data[key])) DB[key] = snapshot.data[key];
                            });
                        }
                    } catch (refreshError) {
                        console.warn('Meeting saved but full workspace refresh is unavailable.', refreshError);
                    }
                    localStorage.setItem('eprocurement_db', JSON.stringify(DB));
                } else {
                    const when = new Date().toISOString();
                    const previous = { date: current.date, time: current.time, durationMinutes: meetingDuration(current.durationMinutes),
                        meetingMode: current.meetingMode, venue: current.venue, notes: current.notes, status: current.status,
                        reason, changedAt: when, changedBy: DB.currentUser.name };
                    current.rescheduleHistory = [...(Array.isArray(current.rescheduleHistory) ? current.rescheduleHistory : []), previous];
                    Object.assign(current, { date, time, durationMinutes, meetingMode, venue, notes, status: 'Pending Response',
                        rescheduleReason: reason, rescheduledBy: DB.currentUser.name, rescheduledAt: when,
                        rescheduleCount: (current.rescheduleCount || 0) + 1 });
                    logAudit('Proposal Meeting Rescheduled', `Meeting ${current.id} with ${current.supplierName} rescheduled to ${date} at ${time} (${durationMinutes} minutes). Reason: ${reason}`);
                }
                showToast(`Meeting ${current.id} rescheduled. A new supplier confirmation is required.`, 'success');
                closeModal();
            } catch (error) {
                showToast(error instanceof Error ? error.message : 'Could not save the updated meeting.', 'error');
            } finally {
                isSubmitting = false;
                if (submit?.isConnected) { submit.textContent = 'Send Updated Invite'; checkConflicts(); }
            }
        });
    }

    const cancelMeetingForm = document.getElementById('cancel-meeting-form');
    if (cancelMeetingForm) {
        cancelMeetingForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const reason = document.getElementById('mtg-cancel-reason').value;
            if (cancelProposalMeeting(ui.selectedRecord, reason)) closeModal();
        });
    }

    const finalizeAgreementForm = document.getElementById('finalize-agreement-form');
    if (finalizeAgreementForm) {
        finalizeAgreementForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const bid = DB.bids.find(item => item.id === ui.selectedRecord);
            const need = DB.stockNeeds.find(item => item.id === bid?.needId);
            const pr = DB.requisitions.find(item => item.id === need?.prId);
            const unitPrice = Number(document.getElementById('agreement-unit-price').value);
            const quantity = Number(document.getElementById('agreement-quantity').value);
            const specs = document.getElementById('agreement-specs').value.trim();
            const terms = document.getElementById('agreement-terms').value.trim();

            const blockReason = getAgreementFinalizationError(ui.selectedRecord);
            if (blockReason) {
                showToast(blockReason, 'error');
                return;
            }
            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                showToast('Enter a valid agreed unit price in Philippine pesos.', 'error');
                return;
            }
            if (!Number.isInteger(quantity) || quantity < 1) {
                showToast('Enter an agreed quantity as a whole number greater than zero.', 'error');
                return;
            }
            if (!specs) {
                showToast('Enter the final specifications and requirements before issuing the Purchase Order.', 'error');
                return;
            }
            if (!terms) {
                showToast('Enter the agreed terms before issuing the Purchase Order.', 'error');
                return;
            }

            const newPO = {
                id: 'PO-' + (5000 + DB.orders.length + 1),
                prId: pr.id,
                needId: need.id,
                bidId: bid.id,
                supplierId: bid.supplierId,
                supplierName: bid.supplierName,
                department: pr.department,
                itemTitle: need.title,
                specs,
                quantity,
                unit: need.unit || 'units',
                priority: pr.priority || null,
                purchaseCategory: pr.purchaseCategory || 'Goods & Materials',
                recurrence: pr.recurrence || 'One-time',
                unitPrice,
                totalCost: quantity * unitPrice,
                agreedTerms: terms,
                poDate: new Date().toISOString().substring(0, 10),
                status: 'Awaiting Supplier Signature',
                type: isPhysicalPurchase(pr.purchaseCategory) ? 'Purchase Order' : 'Job Order',
                createdByName: DB.currentUser.name
            };

            need.status = 'Awarded';
            pr.status = 'In Process';
            DB.orders.unshift(newPO);
            DB.payments.unshift({
                id: 'PAY-' + (9000 + DB.payments.length + 1),
                poId: newPO.id,
                supplierName: bid.supplierName,
                department: pr.department,
                totalAmount: newPO.totalCost,
                deliveryVerified: false,
                paymentAmount: newPO.totalCost,
                paymentMethod: '',
                paymentDate: '',
                status: 'Pending',
                refNumber: '',
                remarks: 'Awaiting supplier signature, delivery, and inspection.'
            });

            logAudit('PO Issued', `Purchase Order ${newPO.id} issued to selected supplier ${bid.supplierName}; awaiting supplier signature.`);
            Storage.save(DB);
            showToast(`Purchase Order ${newPO.id} issued for supplier signature.`, 'success');
            closeModal();
        });
    }
}
