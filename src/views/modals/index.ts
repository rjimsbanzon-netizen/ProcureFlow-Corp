// @ts-nocheck
import { ui } from '../../store/state';
import { renderFinalizeAgreementModal } from './agreement';
import { renderInitiateAmendmentModal } from './amendment';
import { renderSubmitBidModal } from './bid';
import { renderInspectDeliveryModal, renderRecordDeliveryModal } from './delivery';
import { renderCancelProposalMeetingModal, renderRequestMeetingRescheduleModal, renderReviewMeetingRescheduleModal, renderRescheduleMeetingModal, renderScheduleMeetingModal } from './meeting';
import { renderProcessPaymentModal } from './payment';
import { renderRateSupplierModal, renderViewRatingsModal } from './rating';
import { renderCreatePRModal } from './requisition';
import { renderCreateStockNeedModal } from './stockNeed';
import { renderAddSupplierModal } from './supplier';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderModalContainer() {
    if (!ui.currentModal) return '';

    switch(ui.currentModal) {
        case 'create_pr': return renderCreatePRModal();
        case 'record_delivery': return renderRecordDeliveryModal();
        case 'inspect_delivery': return renderInspectDeliveryModal();
        case 'rate_supplier': return renderRateSupplierModal();
        case 'view_ratings': return renderViewRatingsModal();
        case 'add_supplier': return renderAddSupplierModal();
        case 'process_payment': return renderProcessPaymentModal();
        case 'initiate_amendment': return renderInitiateAmendmentModal();
        case 'create_stock_need': return renderCreateStockNeedModal();
        case 'submit_bid': return renderSubmitBidModal();
        case 'schedule_meeting': return renderScheduleMeetingModal();
        case 'reschedule_meeting': return renderRescheduleMeetingModal();
        case 'request_meeting_reschedule': return renderRequestMeetingRescheduleModal();
        case 'review_meeting_reschedule': return renderReviewMeetingRescheduleModal();
        case 'cancel_meeting': return renderCancelProposalMeetingModal();
        case 'finalize_agreement': return renderFinalizeAgreementModal();
        default: return '';
    }
}
