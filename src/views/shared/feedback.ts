/** Controlled application copy only: never interpolate unescaped user values. */
export function emptyTableRow(columns: number, title: string, description: string, icon = 'fa-folder-open') {
  return `<tr><td colspan="${columns}" class="pf-empty-cell">
    <div class="pf-feedback-state pf-feedback-empty" role="status">
      <span class="pf-feedback-icon" aria-hidden="true"><i class="fa-solid ${icon}"></i></span>
      <h3>${title}</h3><p>${description}</p>
    </div>
  </td></tr>`;
}

export function emptyPanel(title: string, description: string, icon = 'fa-folder-open') {
  return `<div class="pf-feedback-state pf-feedback-empty" role="status">
    <span class="pf-feedback-icon" aria-hidden="true"><i class="fa-solid ${icon}"></i></span>
    <h3>${title}</h3><p>${description}</p>
  </div>`;
}
