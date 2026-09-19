import React, { useCallback, useMemo, useState } from 'react';
import { EntityIcon } from '../../shared/EntityIcon';
import ItemGridPicker from '../../shared/ItemGridPicker';
import { formatPower } from '../../../i18n';
import { useCatalog } from '../CatalogContext';
import { useWorkbenchDraft } from '../WorkbenchDraftContext';
import { useSolve } from '../SolveContext';
import { buildFocusItemOptions } from '../workbenchHelpers';
import { focusBarStyle, focusChipStyle, focusChipRemoveStyle, focusClearButtonStyle } from '../workbenchStyles';

export default function FocusFilterBar() {
  const { bundle, locale, iconAtlasIds, itemOptions } = useCatalog();
  const { model } = useSolve();
  const { focusItemIds, focusResult, addFocusItem, removeFocusItem, clearFocusItems } = useWorkbenchDraft();
  const [query, setQuery] = useState('');

  const focusSet = useMemo(() => new Set(focusItemIds), [focusItemIds]);

  const availableItems = useMemo(
    () => buildFocusItemOptions(itemOptions, new Set(Object.keys(model?.itemSlicesById ?? {})), focusSet),
    [itemOptions, model, focusSet],
  );

  const selectedChips = useMemo(
    () =>
      focusItemIds.map(id => {
        const option = itemOptions.find(o => o.itemId === id);
        return { itemId: id, name: option?.name ?? id, icon: option?.icon };
      }),
    [focusItemIds, itemOptions],
  );

  const handleSelect = useCallback(
    (itemId: string) => {
      addFocusItem(itemId);
      setQuery('');
    },
    [addFocusItem],
  );

  return (
    <div style={focusBarStyle} role="region" aria-label={bundle.focusFilter.focusedSectionTitle}>
      <div style={{ width: '100%', fontSize: 12, color: 'rgba(24, 51, 89, 0.72)' }}>
        {bundle.focusFilter.description}
      </div>
      {selectedChips.map(chip => (
        <span key={chip.itemId} style={focusChipStyle}>
          <EntityIcon
            label={chip.name}
            iconKey={chip.icon}
            atlasIds={iconAtlasIds}
            size={16}
          />
          {chip.name}
          <button
            type="button"
            style={focusChipRemoveStyle}
            onClick={() => removeFocusItem(chip.itemId)}
            aria-label={`${bundle.focusFilter.removeFocusButton} ${chip.name}`}
            title={`${bundle.focusFilter.removeFocusButton} ${chip.name}`}
          >
            ×
          </button>
        </span>
      ))}
      <div style={{ minWidth: 140, flex: '1 1 140px' }}>
        <ItemGridPicker
          items={availableItems}
          selectedItemId=""
          query={query}
          onQueryChange={setQuery}
          onSelect={handleSelect}
          atlasIds={iconAtlasIds}
          searchLabel={bundle.focusFilter.placeholder}
          searchPlaceholder={bundle.focusFilter.placeholder}
          emptyText={bundle.common.none}
          dense
        />
      </div>
      {focusItemIds.length > 0 ? (
        <button type="button" style={focusClearButtonStyle} onClick={clearFocusItems}>
          {bundle.focusFilter.clearButton}
        </button>
      ) : null}
      {focusResult ? (
        <div role="status" style={{ width: '100%', fontSize: 12 }}>
          {bundle.focusFilter.focusedSectionTitle}: {focusResult.summary.recipeCount} {bundle.summary.recipesLabel}
          {' · '}{focusResult.summary.buildingCount} {bundle.summary.buildingsLabel}
          {' · '}{formatPower(focusResult.summary.roundedPlacementPowerMW, locale)}
        </div>
      ) : null}
    </div>
  );
}
