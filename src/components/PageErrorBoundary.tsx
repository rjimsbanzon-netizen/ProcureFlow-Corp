import { Component, type ErrorInfo, type ReactNode } from 'react';
import { renderApp } from '../core/renderBridge';

type State = { failed: boolean };

/** Contains render failures to the current module instead of blanking ProcureFlow. */
export class PageErrorBoundary extends Component<{ children: ReactNode; title?: string }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Do not send user details or transaction data to a third-party logger.
    console.error('ProcureFlow module render failed', error, info.componentStack);
  }

  retry = (): void => {
    this.setState({ failed: false });
    renderApp();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-white p-6 text-slate-800 shadow-sm sm:p-8">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-800" aria-hidden="true"><i className="fa-solid fa-triangle-exclamation"/></div>
      <h2 className="text-xl font-bold">{this.props.title || 'This module could not be displayed'}</h2>
      <p className="mt-2 text-sm text-slate-600">Your account is still signed in. Try reloading this module. If the problem continues, contact Admin with the module name and time of the error.</p>
      <button type="button" onClick={this.retry} className="pf-primary-action mt-5 rounded-lg bg-[#a64f32] px-5 py-2.5 font-semibold text-white hover:bg-[#873e27]">Retry module</button>
    </section>;
  }
}
