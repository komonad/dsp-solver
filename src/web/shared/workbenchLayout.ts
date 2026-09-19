export interface WorkbenchPaneSizes {
  left: number;
  right: number;
}

export interface WorkbenchPaneWidths {
  left: number;
  center: number;
  right: number;
}

export const WORKBENCH_LAYOUT_STORAGE_KEY = 'dspcalc.workbench.layout.v1';
export const PANE_SEPARATOR_WIDTH = 12;
export const MIN_PANE_WIDTHS: WorkbenchPaneWidths = { left: 240, center: 420, right: 280 };

export function parseWorkbenchPaneSizes(text: string | null): WorkbenchPaneSizes | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object') return null;
    const { left, right } = value as WorkbenchPaneSizes;
    return Number.isFinite(left) && Number.isFinite(right) && left > 0 && right > 0 && left + right < 1
      ? { left, right }
      : null;
  } catch {
    return null;
  }
}

export function resolveWorkbenchPaneWidths(containerWidth: number, sizes: WorkbenchPaneSizes | null): WorkbenchPaneWidths {
  const available = Math.max(0, Number.isFinite(containerWidth) ? containerWidth - 2 * PANE_SEPARATOR_WIDTH : 0);
  const minimumTotal = MIN_PANE_WIDTHS.left + MIN_PANE_WIDTHS.center + MIN_PANE_WIDTHS.right;
  const scale = Math.min(1, available / minimumTotal);
  const minLeft = MIN_PANE_WIDTHS.left * scale;
  const minRight = MIN_PANE_WIDTHS.right * scale;
  const minCenter = MIN_PANE_WIDTHS.center * scale;
  const defaultSide = (available - Math.min(760, available * 0.46)) / 2;
  const left = Math.max(minLeft, Math.min(sizes ? available * sizes.left : defaultSide, available - minRight - minCenter));
  const right = Math.max(minRight, Math.min(sizes ? available * sizes.right : defaultSide, available - left - minCenter));
  return { left, center: Math.max(0, available - left - right), right };
}

/** Positive deltas move a separator to the right; the opposite sidebar keeps its width. */
export function resizeWorkbenchPane(widths: WorkbenchPaneWidths, side: 'left' | 'right', delta: number): WorkbenchPaneSizes {
  const total = widths.left + widths.center + widths.right;
  if (total <= 0) return { left: 0.27, right: 0.27 };
  const next = side === 'left' ? widths.left + delta : widths.right - delta;
  const max = widths[side] + widths.center - MIN_PANE_WIDTHS.center;
  const clamped = Math.max(MIN_PANE_WIDTHS[side], Math.min(next, max));
  return {
    left: (side === 'left' ? clamped : widths.left) / total,
    right: (side === 'right' ? clamped : widths.right) / total,
  };
}
