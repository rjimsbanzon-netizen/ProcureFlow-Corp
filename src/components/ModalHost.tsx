import { HtmlView } from './HtmlView';
import { ui } from '../store/state';
import { RequisitionFormModal } from './RequisitionFormModal';
import { renderModalContainer } from '../views/modals';
export function ModalHost() { return ui.currentModal === 'create_pr' || ui.currentModal === 'edit_pr'
  ? <RequisitionFormModal key={ui.currentModal === 'edit_pr' ? String(ui.selectedRecord) : 'create'} editId={ui.currentModal === 'edit_pr' ? String(ui.selectedRecord) : undefined} />
  : ui.currentModal ? <HtmlView html={renderModalContainer()} /> : null; }
