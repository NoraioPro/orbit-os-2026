/** Client-side download helpers for the Data Hub extraction layer. */

export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json');
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: string[]) {
  const header = columns.join(',');
  const lines = rows.map((r) => columns.map((c) => csvCell(r[c])).join(','));
  downloadText(filename, [header, ...lines].join('\n'), 'text/csv;charset=utf-8');
}
