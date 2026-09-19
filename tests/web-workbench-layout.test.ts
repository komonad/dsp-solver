import { parseWorkbenchPaneSizes, resizeWorkbenchPane, resolveWorkbenchPaneWidths } from '../src/web/shared/workbenchLayout';

describe('workbench pane layout', () => {
  test('uses the full width and keeps the default recipe column compact on wide screens', () => {
    for (const width of [1144, 1384, 1864, 2504]) {
      const panes = resolveWorkbenchPaneWidths(width, null);
      expect(panes.left + panes.center + panes.right).toBeCloseTo(width - 24);
      expect(panes.center).toBeLessThanOrEqual(760);
      expect(panes.left).toBeGreaterThanOrEqual(240);
      expect(panes.right).toBeGreaterThanOrEqual(280);
    }
  });

  test.each(['left', 'right'] as const)('constrains the %s separator without moving the opposite sidebar', side => {
    const start = resolveWorkbenchPaneWidths(1384, null);
    const other = side === 'left' ? 'right' : 'left';
    for (const delta of [-10000, -100, 100, 10000]) {
      const next = resolveWorkbenchPaneWidths(1384, resizeWorkbenchPane(start, side, delta));
      expect(next[other]).toBeCloseTo(start[other]);
      expect(next.left).toBeGreaterThanOrEqual(240);
      expect(next.right).toBeGreaterThanOrEqual(280);
      expect(next.center).toBeGreaterThanOrEqual(420 - 0.001);
    }
  });

  test('moves either separator to the right for a positive delta', () => {
    const start = resolveWorkbenchPaneWidths(1384, null);
    expect(resolveWorkbenchPaneWidths(1384, resizeWorkbenchPane(start, 'left', 16)).left).toBeCloseTo(start.left + 16);
    expect(resolveWorkbenchPaneWidths(1384, resizeWorkbenchPane(start, 'right', 16)).right).toBeCloseTo(start.right - 16);
  });

  test('fits saved preferences to a narrower viewport without mutating them', () => {
    const preference = { left: 0.42, right: 0.35 };
    const narrow = resolveWorkbenchPaneWidths(1144, preference);
    expect(narrow.left + narrow.center + narrow.right).toBeCloseTo(1120);
    expect(narrow.center).toBeGreaterThanOrEqual(420);
    expect(narrow.right).toBeGreaterThanOrEqual(280);
    expect(preference).toEqual({ left: 0.42, right: 0.35 });
    expect(resolveWorkbenchPaneWidths(2000, preference).left).toBeCloseTo(1976 * 0.42);
  });

  test('rejects corrupt or impossible persisted sizes', () => {
    for (const text of [null, '', '{', 'null', '[]', '{"left":"0.3","right":0.3}', '{"left":-1,"right":0.3}', '{"left":0.6,"right":0.6}']) {
      expect(parseWorkbenchPaneSizes(text)).toBeNull();
    }
    expect(parseWorkbenchPaneSizes('{"left":0.28,"right":0.31}')).toEqual({ left: 0.28, right: 0.31 });
  });
});
