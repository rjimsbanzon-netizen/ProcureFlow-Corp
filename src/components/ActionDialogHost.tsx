import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { getCurrentDialog, settleDialog, subscribeDialogs, type InputDialogOptions } from '../services/actionDialogs';

/** Global modal layer used by React pages and the legacy event/action modules. */
export function ActionDialogHost() {
  const dialog = useSyncExternalStore(subscribeDialogs, getCurrentDialog, getCurrentDialog);
  const [value, setValue] = useState('');
  const [validation, setValidation] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const titleId = useId();
  const options = dialog?.options;
  const isInput = dialog?.mode === 'input';
  const inputOptions = isInput ? options as InputDialogOptions : null;
  const danger = options?.tone === 'danger';
  const warning = options?.tone === 'warning';

  useEffect(() => {
    if (!dialog) return;
    setValue(dialog.mode === 'input' ? (dialog.options as InputDialogOptions).initialValue ?? '' : '');
    setValidation('');
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = window.setTimeout(() => (dialog.mode === 'input' ? inputRef.current : cancelRef.current)?.focus(), 0);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); settleDialog(dialog.id, dialog.mode === 'input' ? null : false); }
      if (e.key === 'Tab' && panelRef.current) {
        const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])'));
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focus);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [dialog?.id]);

  if (!dialog || !options) return null;
  const dismiss = () => settleDialog(dialog.id, isInput ? null : false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    if (!isInput) { settleDialog(dialog.id, true); return; }
    const entered = value.trim();
    if (inputOptions?.required && !entered) {
      setValidation('This field is required before you can continue.');
      inputRef.current?.focus();
      return;
    }
    if (inputOptions?.exactMatch && entered !== inputOptions.exactMatch) {
      setValidation(`Enter ${inputOptions.exactMatch} exactly to continue.`);
      inputRef.current?.focus();
      return;
    }
    settleDialog(dialog.id, entered);
  }
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#111e1a]/70 px-4 py-5 backdrop-blur-[4px] sm:px-6"
         onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
           className="relative my-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#e6e2d9] bg-[#fcfbf7] text-slate-800 shadow-[0_32px_96px_rgba(0,0,0,0.35)]">
        <div className="h-1 w-full bg-[#bc5c34]" />
        <form onSubmit={submit}>
          <div className="px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
            <div className="flex items-start gap-3">
              <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ' +
                (danger ? 'border-rose-200 bg-rose-50 text-rose-700' : warning ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-[#ebd9ca] bg-[#fbede3] text-[#a64f32]')}>
                <i aria-hidden="true" className={'fa-solid ' + (danger ? 'fa-triangle-exclamation' : warning ? 'fa-circle-exclamation' : isInput ? 'fa-pen-to-square' : 'fa-circle-check')} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#a64f32]">ProcureFlow · {isInput ? 'Required input' : 'Confirmation'}</p>
                <h2 id={titleId} className="mt-1 text-lg font-bold leading-snug tracking-tight text-[#1d2a25] sm:text-xl">{options.title}</h2>
              </div>
              <button type="button" onClick={dismiss} aria-label="Close dialog" className="-mr-1 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a64f32]">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <p id={descriptionId} className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{options.message}</p>
            {isInput && inputOptions && <div className="mt-5">
              <label htmlFor="pf-action-dialog-input" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                {inputOptions.label} {inputOptions.required ? <span className="text-rose-600">*</span> : <span className="font-normal normal-case text-slate-400">(optional)</span>}
              </label>
              {inputOptions.multiline ?
                <textarea id="pf-action-dialog-input" ref={element => { inputRef.current = element; }} rows={4} value={value}
                  onChange={e => { setValue(e.target.value); setValidation(''); }}
                  placeholder={inputOptions.placeholder ?? 'Add your note here...'}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#b95b36] focus:ring-2 focus:ring-[#b95b36]/20" /> :
                <input id="pf-action-dialog-input" ref={element => { inputRef.current = element; }} type="text" value={value}
                  onChange={e => { setValue(e.target.value); setValidation(''); }}
                  placeholder={inputOptions.placeholder ?? 'Type here...'}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#b95b36] focus:ring-2 focus:ring-[#b95b36]/20" />}
              {validation && <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-rose-700" role="alert"><i className="fa-solid fa-circle-exclamation" />{validation}</p>}
              {inputOptions.exactMatch && <p className="mt-2 text-xs text-slate-500">For your protection, type <strong>{inputOptions.exactMatch}</strong> exactly.</p>}
            </div>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e9e6dc] bg-[#f6f3ec] px-5 py-4 sm:px-7">
            <button ref={cancelRef} type="button" onClick={dismiss} className="min-w-[96px] rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a64f32]">{options.cancelText ?? 'Cancel'}</button>
            <button type="submit" className={'min-w-[132px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
              (danger ? 'bg-rose-700 hover:bg-rose-800 focus-visible:outline-rose-600' : 'bg-[#ac5738] hover:bg-[#8a3e27] focus-visible:outline-[#a64f32]')}>
              {options.confirmText ?? (isInput ? 'Continue' : danger ? 'Confirm action' : 'Confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
