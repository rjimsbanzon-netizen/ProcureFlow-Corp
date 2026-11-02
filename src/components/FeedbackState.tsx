import type { ReactNode } from 'react';

type FeedbackProps = {
  title: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
};

/** Shared, accessible feedback for lists which have no results. */
export function EmptyState({ title, description, icon = 'fa-folder-open', action }: FeedbackProps) {
  return <div className="pf-feedback-state pf-feedback-empty" role="status">
    <span className="pf-feedback-icon" aria-hidden="true"><i className={`fa-solid ${icon}`} /></span>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action && <div className="pf-feedback-action">{action}</div>}
  </div>;
}

/** Loading is announced without a blocking modal or flickering placeholder content. */
export function LoadingState({ title = 'Loading records', description }: Pick<FeedbackProps, 'title' | 'description'>) {
  return <div className="pf-feedback-state pf-feedback-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="pf-loading-spinner" aria-hidden="true" />
    <h3>{title}</h3>
    {description && <p>{description}</p>}
  </div>;
}
