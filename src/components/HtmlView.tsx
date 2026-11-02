import type { MouseEvent, ChangeEvent } from 'react';
import { commands } from '../core/commands';

type Props = { html: string; className?: string };
/** Legacy markup adapter. Buttons use safe, delegated commands, not inline JavaScript. */
export function HtmlView({ html, className }: Props) {
  const invoke = (element: HTMLElement, source?: HTMLInputElement | HTMLSelectElement) => {
    const command = element.dataset.command;
    if (!command) return;
    const action = commands[command];
    if (!action) { console.warn('Unknown command:', command); return; }
    const args = [element.dataset.arg1, element.dataset.arg2, element.dataset.arg3]
      .filter((value): value is string => value !== undefined)
      .map(value => value === '@value' ? source?.value : value);
    void action(...args);
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const commandElement = (event.target as HTMLElement).closest<HTMLElement>('[data-command]');
    if (!commandElement || commandElement.tagName === 'SELECT') return;
    event.preventDefault();
    invoke(commandElement);
  };
  const onChange = (event: ChangeEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.dataset.command) return;
    invoke(target, target);
  };
  return <div className={className} onClick={onClick} onChange={onChange}
    dangerouslySetInnerHTML={{ __html: html }} />;
}
