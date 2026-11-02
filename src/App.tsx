import AccountPage from './pages/AccountPage';
import DirectMessagesPage from './pages/DirectMessagesPage';
import EmployeeProfilesPage from './pages/EmployeeProfilesPage';
import SupplierMessagesPage from './pages/SupplierMessagesPage';
import SupplierPerformancePage from './pages/SupplierPerformancePage';
import {MobileQuickActions} from './components/MobileQuickActions';
import GlobalSearchPage from './pages/GlobalSearchPage';
import ApprovalDelegationPage from './pages/ApprovalDelegationPage';
import ContractsPage from './pages/ContractsPage';
import SupplierAccreditationPage from './pages/SupplierAccreditationPage';
import NotificationsPage from './features/notifications/NotificationsPage';
import TrackingPage from './features/tracking/TrackingPage';
import DocumentsPage from './pages/DocumentsPage';
import PdfDocumentsPage from './pages/PdfDocumentsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import BudgetsPage from './pages/BudgetsPage';
import InvoiceMatchingPage from './pages/InvoiceMatchingPage';
import DashboardPage from './pages/DashboardPage';
import BiddingPage from './pages/BiddingPage';
import BiddingDeadlinesPage from './pages/BiddingDeadlinesPage';
import BidComparisonPage from './pages/BidComparisonPage';
import BidEvaluationPage from './pages/BidEvaluationPage';
import ProposalMeetingsPage from './pages/ProposalMeetingsPage';
import RequisitionsPage from './pages/RequisitionsPage';
import OrdersPage from './pages/OrdersPage';
import DeliveryPage from './pages/DeliveryPage';
import AdvancedReportsPage from './pages/AdvancedReportsPage';
import DeliveryDiscrepanciesPage from './pages/DeliveryDiscrepanciesPage';
import InventoryIntegrationPage from './pages/InventoryIntegrationPage';
import SupplierInventoryPage from './pages/SupplierInventoryPage';
import SupplyPlanningPage from './pages/SupplyPlanningPage';
import AmendmentsPage from './pages/AmendmentsPage';
import PaymentsPage from './pages/PaymentsPage';
import SuppliersPage from './pages/SuppliersPage';
import AccessControlPage from './pages/AccessControlPage';
import AuditPage from './pages/AuditPage';
import StaffAssignmentsPage from './pages/StaffAssignmentsPage';
import UsersPage from './pages/UsersPage';
import { useEffect, useState } from 'react';
import { DB, ui, setDB } from './store/state';
import { CLOUD_API_BASE, restoreCloudSession } from './services/cloud';
import { Storage } from './services/storage';
import { registerRenderListener, renderApp, navigateTo } from './core/renderBridge';
import { attachAuthEvents } from './events/authEvents';
import { attachMainEvents } from './events/mainEvents';
import { canAccessTab } from './domain/permissions';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ModalHost } from './components/ModalHost';
import { AuthScreen } from './components/AuthScreen';
import { ActionDialogHost } from './components/ActionDialogHost';
import { PageErrorBoundary } from './components/PageErrorBoundary';

function CurrentPage() {
  if (!canAccessTab(ui.currentTab)) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
      <i className="fa-solid fa-lock text-2xl mb-2"/><p>This section is not available for your account.</p>
    </div>;
  }
  switch (ui.currentTab) {
    case 'dashboard': return <DashboardPage />;
    case 'my_profile': return <AccountPage />;
    case 'people_directory': return <EmployeeProfilesPage />;
    case 'people_messages': return <DirectMessagesPage />;
    case 'global_search': return <GlobalSearchPage />;
    case 'supplier_analytics': return <SupplierPerformancePage />;
    case 'approval_delegation': return <ApprovalDelegationPage />;
    case 'contracts': return <ContractsPage />;
    case 'notifications': return <NotificationsPage />;
    case 'tracking': return <TrackingPage />;
    case 'documents': return <DocumentsPage />;
    case 'approvals': return <ApprovalsPage />;
    case 'budgets': return <BudgetsPage />;
    case 'invoice_matching': return <InvoiceMatchingPage />;
    case 'pdf_generator': return <PdfDocumentsPage />;
    case 'bidding': return <BiddingPage />;
    case 'bidding_deadlines': return <BiddingDeadlinesPage />;
    case 'bid_comparison': return <BidComparisonPage />;
    case 'bid_evaluation': return <BidEvaluationPage />;
    case 'proposal_meetings': return <ProposalMeetingsPage />;
    case 'supplier_messages': return <SupplierMessagesPage />;
    case 'accreditation': return <SupplierAccreditationPage />;
    case 'requisitions': return <RequisitionsPage />;
    case 'orders': return <OrdersPage />;
    case 'delivery': return <DeliveryPage />;
    case 'reports': return <AdvancedReportsPage />;
    case 'delivery_discrepancies': return <DeliveryDiscrepanciesPage />;
    case 'inventory': return <InventoryIntegrationPage />;
    case 'supplier_inventory': return <SupplierInventoryPage />;
    case 'supply_planning': return <SupplyPlanningPage />;
    case 'amendments': return <AmendmentsPage />;
    case 'payments': return <PaymentsPage />;
    case 'suppliers': return <SuppliersPage />;
    case 'access_control': return <AccessControlPage />;
    case 'audit': return <AuditPage />;
    case 'staff_assignments': return <StaffAssignmentsPage />;
    case 'users': return <UsersPage />;
    default: return <DashboardPage />;
  }
}

export default function App() {
  const [revision, trigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    registerRenderListener(() => trigger(n => n + 1));
    ui.authMode = 'login';
    setDB(CLOUD_API_BASE ? Storage.empty() : Storage.get());
    if (CLOUD_API_BASE) void restoreCloudSession();
    else renderApp();
    return () => registerRenderListener(null);
  }, []);

  // The mobile drawer is independent of the procurement navigation and keeps
  // the existing role-based routes unchanged.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktop);
    };
  }, [mobileMenuOpen]);

  // Accessible across the app; never steals Ctrl/Cmd+K from signed-out users.
  useEffect(() => {
    const searchShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'k') return;
      if (!DB.currentUser || !canAccessTab('global_search')) return;
      event.preventDefault();
      if (ui.currentTab !== 'global_search') navigateTo('global_search');
      window.setTimeout(() => document.getElementById('pf-global-search-input')?.focus(), 0);
    };
    document.addEventListener('keydown', searchShortcut);
    return () => document.removeEventListener('keydown', searchShortcut);
  }, []);

  // Re-bind legacy page/modals after their revision-scoped markup is updated.
  // The persistent Logout/Reset controls are guarded against duplicate binding.
  useEffect(() => {
    if (DB.currentUser) attachMainEvents();
    else attachAuthEvents();
  }, [revision]);

  return <>
    {DB.currentUser ?
      <div className="enterprise-shell flex h-screen min-h-0 bg-slate-100 overflow-hidden">
        {mobileMenuOpen && <button type="button" className="pf-nav-backdrop" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} />}
        <Sidebar isMobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <Header onOpenMenu={() => setMobileMenuOpen(true)} isMenuOpen={mobileMenuOpen} />
          <main id="procureflow-content" className="enterprise-main flex-1 min-w-0 min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-50 custom-scrollbar"><PageErrorBoundary key={ui.currentTab}><CurrentPage key={revision} /></PageErrorBoundary></main>
        </div>
        <PageErrorBoundary title="The current dialog could not be displayed"><ModalHost key={revision} /></PageErrorBoundary>
        <MobileQuickActions isMenuOpen={mobileMenuOpen} onOpenMenu={() => setMobileMenuOpen(true)} />
      </div>  : <div key={revision}><AuthScreen /></div>}
    <ActionDialogHost />
    <div id="toast-container" className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none" />
  </>;
}
