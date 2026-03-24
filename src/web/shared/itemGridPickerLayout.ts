export const ITEM_GRID_PICKER_GRID_WIDTH_PX = 332;

const ITEM_GRID_PICKER_SEARCH_MIN_WIDTH_PX = ITEM_GRID_PICKER_GRID_WIDTH_PX;
const ITEM_GRID_PICKER_SEARCH_MAX_WIDTH_PX = 520;
const ITEM_GRID_PICKER_SEARCH_BASE_WIDTH_PX = 120;
const ITEM_GRID_PICKER_SEARCH_CHAR_WIDTH_PX = 9;

export function resolveItemGridPickerSearchWidth(query: string): number {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return ITEM_GRID_PICKER_SEARCH_MIN_WIDTH_PX;
  }

  const estimatedWidth =
    ITEM_GRID_PICKER_SEARCH_BASE_WIDTH_PX +
    normalizedQuery.length * ITEM_GRID_PICKER_SEARCH_CHAR_WIDTH_PX;

  return Math.min(
    ITEM_GRID_PICKER_SEARCH_MAX_WIDTH_PX,
    Math.max(ITEM_GRID_PICKER_SEARCH_MIN_WIDTH_PX, estimatedWidth)
  );
}
