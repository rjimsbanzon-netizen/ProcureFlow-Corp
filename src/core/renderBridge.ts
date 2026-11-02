import { ui } from '../store/state';

/** Imperative business workflows request a React render through this tiny bridge. */
let listener: (() => void) | null = null;
const subscriptions = new Set<() => void>();
let renderVersion = 0;
/** React data hooks subscribe to the same updates as the legacy action bridge. */
export function subscribeRender(callback: () => void): () => void {
  subscriptions.add(callback);
  return () => { subscriptions.delete(callback); };
}
export function getRenderVersion(): number { return renderVersion; }
export function registerRenderListener(callback: (() => void) | null) { listener = callback; }
export function renderApp() {
  renderVersion += 1;
  listener?.();
  subscriptions.forEach(callback => callback());
}
export function navigateTo(tab: string) { ui.currentTab = tab; renderApp(); }

/** Open the transaction timeline at the selected purchase requisition. */
export function openTracking(prId: string) { ui.trackingRecordId = prId; navigateTo('tracking'); }
