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

  const filteredItems = useMemo(() => filterItemPickerOptions(items, query), [items, query]);

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
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 1,
          maxHeight: 252,
          minHeight: 124,
          overflowY: 'auto',
          p: 0.25,
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
          filteredItems.map(item => {
            const isSelected = item.itemId === selectedItemId;
            return (
              <button
                key={item.itemId}
                type="button"
                onClick={() => onSelect(item.itemId)}
                style={{
                  display: 'grid',
                  gap: 6,
                  justifyItems: 'center',
                  alignContent: 'start',
                  minHeight: 92,
                  padding: '10px 8px',
                  borderRadius: 14,
                  border: isSelected
                    ? '1px solid rgba(24, 88, 163, 0.64)'
                    : '1px solid rgba(24, 51, 89, 0.12)',
                  background: isSelected ? 'rgba(24, 88, 163, 0.10)' : 'rgba(255, 255, 255, 0.92)',
                  color: '#183359',
                  cursor: 'pointer',
                  textAlign: 'center',
                  contentVisibility: 'auto',
                  containIntrinsicSize: '92px',
                }}
              >
                <EntityIcon
                  label={item.name}
                  iconKey={item.icon}
                  atlasIds={atlasIds}
                  size={28}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                  title={item.name}
                >
                  {item.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'rgba(24, 51, 89, 0.68)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}
                  title={item.itemId}
                >
                  {item.itemId}
                </span>
              </button>
            );
          })
        )}
      </Box>
    </Box>
  );
}
