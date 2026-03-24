import React from 'react';
import { EntityIcon, EntityLabelButton } from '../shared/EntityIcon';
import { openItemSliceOverlay } from '../itemSlice/itemSliceStore';

// ---------------------------------------------------------------------------
// ClickableItemLabel
// ---------------------------------------------------------------------------

export interface ClickableItemLabelProps {
  itemId: string;
  itemName: string;
  iconKey?: string;
  iconOnly?: boolean;
  iconSize?: number;
  atlasIds?: string[];
}

export function ClickableItemLabel({
  itemId,
  itemName,
  iconKey,
  iconOnly = false,
  iconSize = 18,
  atlasIds,
}: ClickableItemLabelProps) {
  return (
    <button
      type="button"
      onClick={() => openItemSliceOverlay(itemId)}
      style={{
        border: 'none',
        padding: 0,
        margin: 0,
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: 0,
      }}
      title={itemName}
    >
      {iconOnly ? (
        <EntityIcon
          label={itemName}
          iconKey={iconKey}
          atlasIds={atlasIds}
          size={iconSize}
        />
      ) : (
        <EntityLabelButton
          label={itemName}
          iconKey={iconKey}
          atlasIds={atlasIds}
          size={iconSize}
          gap={8}
          onClick={() => openItemSliceOverlay(itemId)}
        />
      )}
    </button>
  );
}
