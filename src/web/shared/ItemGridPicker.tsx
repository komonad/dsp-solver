import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, InputAdornment, Popover, TextField, Typography } from '@mui/material';
import { EntityIcon } from './EntityIcon';
import { filterItemPickerOptions, type ItemPickerOption } from './itemPickerModel';
import {
  ITEM_GRID_PICKER_GRID_WIDTH_PX,
  resolveItemGridPickerPopoverWidth,
} from './itemGridPickerLayout';

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
  selectedItemName?: string;
  selectedItemIcon?: string;
  disabled?: boolean;
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
    selectedItemName,
    selectedItemIcon,
    disabled = false,
  } = props;

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);

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

  const handleSelect = useCallback(
    (itemId: string) => {
      onSelect(itemId);
      setOpen(false);
    },
    [onSelect],
  );

  const popoverContentWidth = resolveItemGridPickerPopoverWidth(query);
  const popoverPaperWidth = popoverContentWidth + 20;

  useEffect(() => {
    if (!open || disabled) {
      return undefined;
    }

    const frameHandle = window.requestAnimationFrame(() => {
      const input = popoverSearchInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
    });

    return () => window.cancelAnimationFrame(frameHandle);
  }, [disabled, open]);

  return (
    <Box ref={anchorRef}>
      <TextField
        fullWidth
        size="small"
        label={searchLabel}
        placeholder={selectedItemName || searchPlaceholder}
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
          }
        }}
        onFocus={() => {
          if (!disabled) {
            setOpen(true);
          }
        }}
        disabled={disabled}
        slotProps={{
          input: {
            startAdornment: selectedItemId && selectedItemIcon ? (
              <InputAdornment position="start">
                <EntityIcon
                  label={selectedItemName ?? ''}
                  iconKey={selectedItemIcon}
                  atlasIds={atlasIds}
                  size={20}
                />
              </InputAdornment>
            ) : undefined,
          },
        }}
      />

      <Popover
        open={open && !disabled}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{
          paper: {
            sx: {
              width: `min(calc(100vw - 32px), ${popoverPaperWidth}px)`,
              maxWidth: 'calc(100vw - 32px)',
              mt: 0.5,
              p: 1.25,
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(24, 51, 89, 0.12)',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 0.9,
            width: `min(calc(100vw - 64px), ${popoverContentWidth}px)`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {searchLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {`${filteredItems.length} / ${items.length}`}
            </Typography>
          </Box>

          <TextField
            size="small"
            value={query}
            inputRef={popoverSearchInputRef}
            placeholder={searchPlaceholder}
            onChange={event => onQueryChange(event.target.value)}
            sx={{
              width: '100%',
              '& .MuiInputBase-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
              },
            }}
            slotProps={{
              htmlInput: {
                'aria-label': searchLabel,
                autoComplete: 'off',
                spellCheck: 'false',
              },
            }}
          />

          <Box
            sx={{
              width: `min(100%, ${ITEM_GRID_PICKER_GRID_WIDTH_PX}px)`,
              justifySelf: 'start',
              display: 'grid',
              gap: 0.35,
              maxHeight: 252,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {filteredItems.length === 0 ? (
              <Box
                sx={{
                  gridColumn: '1 / -1',
                  minHeight: 80,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px dashed rgba(24, 51, 89, 0.18)',
                  borderRadius: '12px',
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
                        onClick={() => handleSelect(item.itemId)}
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
                          filter: isSelected
                            ? 'drop-shadow(0 0 0.75px rgba(24, 88, 163, 0.9))'
                            : 'none',
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
      </Popover>
    </Box>
  );
}
