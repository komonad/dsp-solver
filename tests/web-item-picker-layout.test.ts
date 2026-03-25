import {
  ITEM_GRID_PICKER_GRID_WIDTH_PX,
  resolveItemGridPickerPopoverWidth,
  resolveItemGridPickerSearchWidth,
} from '../src/web/shared/itemGridPickerLayout';

test('resolveItemGridPickerSearchWidth keeps the shared grid width as the minimum', () => {
  expect(resolveItemGridPickerSearchWidth('')).toBe(ITEM_GRID_PICKER_GRID_WIDTH_PX);
  expect(resolveItemGridPickerSearchWidth('  ')).toBe(ITEM_GRID_PICKER_GRID_WIDTH_PX);
  expect(resolveItemGridPickerSearchWidth('abc')).toBe(ITEM_GRID_PICKER_GRID_WIDTH_PX);
});

test('resolveItemGridPickerSearchWidth expands for long search text and stays capped', () => {
  expect(resolveItemGridPickerSearchWidth('long-search-query-for-item-picker')).toBeGreaterThan(
    ITEM_GRID_PICKER_GRID_WIDTH_PX
  );
  expect(resolveItemGridPickerSearchWidth('x'.repeat(120))).toBe(520);
});

test('resolveItemGridPickerPopoverWidth follows the larger of the grid and search widths', () => {
  expect(resolveItemGridPickerPopoverWidth('')).toBe(ITEM_GRID_PICKER_GRID_WIDTH_PX);
  expect(resolveItemGridPickerPopoverWidth('long-search-query-for-item-picker')).toBe(
    resolveItemGridPickerSearchWidth('long-search-query-for-item-picker')
  );
});
