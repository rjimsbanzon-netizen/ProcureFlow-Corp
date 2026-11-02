/** App-wide, promise-based dialogs. Never use the browser's prompt/confirm popups. */
export type DialogTone = 'default' | 'danger' | 'warning';
export type DialogOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
};
export type InputDialogOptions = DialogOptions & {
  label: string;
  initialValue?: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  exactMatch?: string;
};
export type DialogRequest = {
  id: number;
  mode: 'confirm' | 'input';
  options: DialogOptions | InputDialogOptions;
  resolve: (result: boolean | string | null) => void;
};

let nextId = 1;
let current: DialogRequest | null = null;
const pending: DialogRequest[] = [];
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
function pump() {
  if (!current) current = pending.shift() ?? null;
  notify();
}
function open(mode: 'confirm' | 'input', options: DialogOptions | InputDialogOptions): Promise<boolean | string | null> {
  return new Promise(resolve => {
    pending.push({ id: nextId++, mode, options, resolve });
    pump();
  });
}
export function confirmAction(options: DialogOptions): Promise<boolean> {
  return open('confirm', options) as Promise<boolean>;
}
export function requestInput(options: InputDialogOptions): Promise<string | null> {
  return open('input', options) as Promise<string | null>;
}
export function getCurrentDialog() { return current; }
export function subscribeDialogs(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
export function settleDialog(id: number, result: boolean | string | null) {
  if (!current || current.id !== id) return;
  const done = current;
  current = null;
  done.resolve(result);
  pump();
}
