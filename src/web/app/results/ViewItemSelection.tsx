import React, { useMemo, useState } from 'react';
import { EntityIcon } from '../../shared/EntityIcon';
import ItemGridPicker from '../../shared/ItemGridPicker';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import { buildFocusItemOptions } from '../workbenchHelpers';
import { focusChipStyle, focusChipRemoveStyle, focusClearButtonStyle, viewRawChipStyle, viewItemSelectionStyle } from '../workbenchStyles';

interface ViewItemSelectionProps {
  itemIds: string[];
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
  placeholder: string;
  removeLabel: string;
  clearLabel: string;
  boundary?: boolean;
}

export default function ViewItemSelection(props: ViewItemSelectionProps) {
  const { itemIds, onAdd, onRemove, onClear, placeholder, removeLabel, clearLabel, boundary } = props;
  const { bundle, iconAtlasIds, itemOptions } = useCatalog();
  const { model } = useSolve();
  const [query, setQuery] = useState('');
  const availableItems = useMemo(
    () => buildFocusItemOptions(itemOptions, new Set(Object.keys(model?.itemSlicesById ?? {})), new Set(itemIds)),
    [itemOptions, model, itemIds],
  );
  const itemsById = useMemo(() => new Map(itemOptions.map(item => [item.itemId, item])), [itemOptions]);

  return (
    <div style={viewItemSelectionStyle}>
      {itemIds.map(itemId => {
        const item = itemsById.get(itemId);
        const name = item?.name ?? itemId;
        return (
          <span key={itemId} style={boundary ? viewRawChipStyle : focusChipStyle}>
            <EntityIcon label={name} iconKey={item?.icon} atlasIds={iconAtlasIds} size={16} />
            {name}
            <button type="button" style={focusChipRemoveStyle} onClick={() => onRemove(itemId)}
              aria-label={`${removeLabel} ${name}`} title={`${removeLabel} ${name}`}>
              ×
            </button>
          </span>
        );
      })}
      <div style={{ minWidth: 140, flex: '1 1 140px' }}>
        <ItemGridPicker items={availableItems} selectedItemId="" query={query} onQueryChange={setQuery}
          onSelect={itemId => { onAdd(itemId); setQuery(''); }} atlasIds={iconAtlasIds}
          searchLabel={placeholder} searchPlaceholder={placeholder} emptyText={bundle.common.none} dense />
      </div>
      {itemIds.length > 0 ? (
        <button type="button" style={focusClearButtonStyle} onClick={onClear}>{clearLabel}</button>
      ) : null}
    </div>
  );
}
