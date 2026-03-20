import React, { useMemo } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { EntityIcon } from './EntityIcon';
import { filterItemPickerOptions, type ItemPickerOption } from './itemPickerModel';

interface ItemGridPickerProps {
  items: ItemPickerOption[];
  selectedItemId: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (itemId: string) => void;
  atlasIds?: string[];
  searchLabel: string;
  searchPlaceholder: string;
  emptyText: string;
}

export default function ItemGridPicker(props: ItemGridPickerProps) {
  const {
    items,
    selectedItemId,
    query,
    onQueryChange,
    onSelect,
    atlasIds,
    searchLabel,
    searchPlaceholder,
    emptyText,
  } = props;

  const filteredItems = useMemo(() => {
    const filtered = filterItemPickerOptions(items, query);
    return [...filtered].sort((left, right) => {
      const leftPrefix = left.itemId.charAt(0);
      const rightPrefix = right.itemId.charAt(0);
      if (leftPrefix !== rightPrefix) {
        return leftPrefix.localeCompare(rightPrefix);
      }
      return left.itemId.localeCompare(right.itemId, 'en');
    });
  }, [items, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ItemPickerOption[]>();
    for (const item of filteredItems) {
      const key = item.itemId.charAt(0) || '#';
      const existing = groups.get(key);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(key, [item]);
      }
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <TextField
        fullWidth
        size="small"
        label={searchLabel}
        placeholder={searchPlaceholder}
        value={query}
        onChange={event => onQueryChange(event.target.value)}
      />

      <Typography variant="caption" color="text.secondary">
        {`${filteredItems.length} / ${items.length}`}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 0.35,
          maxHeight: 252,
          minHeight: 124,
          overflowY: 'auto',
        }}
      >
        {filteredItems.length === 0 ? (
          <Box
            sx={{
              gridColumn: '1 / -1',
              minHeight: 108,
              display: 'grid',
              placeItems: 'center',
              border: '1px dashed rgba(24, 51, 89, 0.18)',
              borderRadius: '16px',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {emptyText}
            </Typography>
          </Box>
        ) : (
          groupedItems.map(([groupKey, group]) => (
            <Box
              key={groupKey}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(28px, 28px))',
                gap: 0.2,
                alignItems: 'center',
                alignContent: 'start',
              }}
            >
              {group.map(item => {
                const isSelected = item.itemId === selectedItemId;
                return (
                  <button
                    key={item.itemId}
                    type="button"
                    onClick={() => onSelect(item.itemId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      minHeight: 28,
                      padding: 0,
                      borderRadius: 0,
                      border: 'none',
                      background: 'transparent',
                      color: '#183359',
                      cursor: 'pointer',
                      textAlign: 'center',
                      contentVisibility: 'auto',
                      containIntrinsicSize: '28px',
                      justifySelf: 'center',
                      opacity: isSelected ? 1 : 0.92,
                      filter: isSelected ? 'drop-shadow(0 0 0.75px rgba(24, 88, 163, 0.9))' : 'none',
                    }}
                    title={`${item.name} (${item.itemId})`}
                  >
                    <EntityIcon
                      label={item.name}
                      iconKey={item.icon}
                      atlasIds={atlasIds}
                      size={28}
                    />
                  </button>
                );
              })}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
