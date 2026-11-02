// @ts-nocheck
import { renderApp } from '../core/renderBridge';
import { ui } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function closeModal() {
    ui.currentModal = null;
    ui.selectedRecord = null;
    renderApp();
}
