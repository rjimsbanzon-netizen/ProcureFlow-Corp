import { acceptPurchaseOrder, openAddSupplierModal, openInitiateAmendmentModal, openInspectDeliveryModal, openProcessPaymentModal, openRateSupplierModal, openRecordDeliveryModal, viewSupplierRatingsModal } from '../actions/orderActions';
import { approveAmendment, rejectAmendment } from '../actions/amendmentActions';
import { approvePR, rejectPR, viewPRDetails } from '../actions/requisitionActions';
import { approveUser, deleteUserAccount, rejectUser, revokeUser, saveAccessControlMatrix, saveUserRole, updateUserRole } from '../actions/userActions';
import { closeModal } from '../actions/modalActions';
import { navigateTo } from './renderBridge';
import { openCancelProposalMeetingModal, openCreateStockNeedModal, openFinalizeAgreementModal, openRequestMeetingRescheduleModal, openReviewMeetingRescheduleModal, openRescheduleMeetingModal, openScheduleMeetingModal, openSubmitBidModal, respondProposalMeeting, selectBid } from '../actions/biddingActions';

/** Explicit command whitelist: no eval, no inline browser JavaScript. */
export const commands: Record<string, (...args: any[]) => unknown> = {
  acceptPurchaseOrder,
  approveAmendment,
  approvePR,
  approveUser,
  closeModal,
  deleteUserAccount,
  navigateTo,
  openAddSupplierModal,
  openCancelProposalMeetingModal,
  openCreateStockNeedModal,
  openFinalizeAgreementModal,
  openInitiateAmendmentModal,
  openInspectDeliveryModal,
  openProcessPaymentModal,
  openRateSupplierModal,
  openRecordDeliveryModal,
  openRequestMeetingRescheduleModal,
  openReviewMeetingRescheduleModal,
  openRescheduleMeetingModal,
  openScheduleMeetingModal,
  openSubmitBidModal,
  rejectAmendment,
  rejectPR,
  rejectUser,
  respondProposalMeeting,
  revokeUser,
  saveAccessControlMatrix,
  saveUserRole,
  selectBid,
  updateUserRole,
  viewPRDetails,
  viewSupplierRatingsModal
};
