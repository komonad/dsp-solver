export interface ItemPickerOption {
  itemId: string;
  name: string;
  icon?: string;
}

function normalizeSearchText(text: string): string {
  return text.trim().toLocaleLowerCase('zh-CN');
}

function buildSearchHaystack(option: ItemPickerOption): string {
  return `${option.itemId} ${option.name}`.toLocaleLowerCase('zh-CN');
}

function scoreMatch(haystack: string, option: ItemPickerOption, query: string): number | null {
  const normalizedId = option.itemId.toLocaleLowerCase('zh-CN');
  const normalizedName = option.name.toLocaleLowerCase('zh-CN');

  if (normalizedId === query) {
    return 0;
  }
  if (normalizedName === query) {
    return 1;
  }
  if (normalizedId.startsWith(query)) {
    return 2;
  }
  if (normalizedName.startsWith(query)) {
    return 3;
  }
  if (normalizedId.includes(query)) {
    return 4;
  }
  if (normalizedName.includes(query)) {
    return 5;
  }
  if (haystack.includes(query)) {
    return 6;
  }
  return null;
}

export function filterItemPickerOptions(
  options: ItemPickerOption[],
  query: string
): ItemPickerOption[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return options;
  }

  const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);

  return options
    .map(option => {
      const haystack = buildSearchHaystack(option);
      let score = 0;
      for (const queryPart of queryParts) {
        const matchScore = scoreMatch(haystack, option, queryPart);
        if (matchScore === null) {
          return null;
        }
        score += matchScore;
      }
      return { option, score };
    })
    .filter((entry): entry is { option: ItemPickerOption; score: number } => Boolean(entry))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      const nameCompare = left.option.name.localeCompare(right.option.name, 'zh-CN');
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return left.option.itemId.localeCompare(right.option.itemId, 'zh-CN');
    })
    .map(entry => entry.option);
}
