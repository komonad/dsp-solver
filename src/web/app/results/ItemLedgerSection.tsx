import React from 'react';
import type { PresentationModel } from '../../../presentation';
import { EntityLabelButton } from '../../shared/EntityIcon';
import { openItemSliceOverlay } from '../../itemSlice/state/itemSliceStore';
import { useCatalog } from '../CatalogContext';
import { useWorkbench } from '../WorkbenchContext';
import { useWorkbenchDraft } from '../WorkbenchDraftContext';
import { useFocusFilter } from '../useFocusFilter';
import { formatItemRateLabel, splitByFocus } from '../workbenchHelpers';
import { compactLedgerButtonStyle, focusButtonStyle, focusDimmedStyle, focusDividerStyle, focusDividerLabelStyle } from '../workbenchStyles';

export interface ItemLedgerSectionProps {
  section: PresentationModel['itemLedgerSections'][number];
}

const ItemRow = React.memo(function ItemRow({
  entry,
  dimmed,
}: {
  entry: ItemLedgerSectionProps['section']['items'][number];
  dimmed?: boolean;
}) {
  const { bundle, locale, iconAtlasIds, catalog } = useCatalog();
  const { markItemAsRawInput, unmarkItemAsRawInput } = useWorkbench();
  const { focusItemIds, addFocusItem, removeFocusItem } = useWorkbenchDraft();

  const isFocused = focusItemIds.includes(entry.itemId);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 10,
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid rgba(24, 51, 89, 0.10)',
        contentVisibility: 'auto',
        containIntrinsicSize: '56px 280px',
        contain: 'layout paint style',
        ...(dimmed ? focusDimmedStyle : undefined),
      }}
    >
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <EntityLabelButton
            label={entry.itemName}
            iconKey={entry.iconKey}
            atlasIds={iconAtlasIds}
            size={20}
            textStyle={{ fontWeight: 700 }}
            onClick={() => openItemSliceOverlay(entry.itemId)}
          />
          {entry.isRawInput ? (
            <span style={{ padding: '2px 6px', borderRadius: 999, background: 'rgba(24, 51, 89, 0.10)', fontSize: 11, fontWeight: 700 }}>
              {bundle.itemLedger.rawBadge}
            </span>
          ) : null}
          {entry.isTarget ? (
            <span style={{ padding: '2px 6px', borderRadius: 999, background: 'rgba(212, 120, 48, 0.14)', fontSize: 11, fontWeight: 700 }}>
              {bundle.itemLedger.targetBadge}
            </span>
          ) : null}
          {entry.isSurplusOutput ? (
            <span style={{ padding: '2px 6px', borderRadius: 999, background: 'rgba(56, 143, 122, 0.14)', fontSize: 11, fontWeight: 700 }}>
              {bundle.itemLedger.surplusBadge}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'rgba(24, 51, 89, 0.78)' }}>
          <span>{bundle.diagnostics.producedLabel} {formatItemRateLabel(entry.itemId, entry.producedRatePerMin, locale, catalog?.powerItemId)}</span>
          <span>{bundle.diagnostics.consumedLabel} {formatItemRateLabel(entry.itemId, entry.consumedRatePerMin, locale, catalog?.powerItemId)}</span>
          {Math.abs(entry.netRatePerMin) > 1e-8 ? (
            <span>{bundle.diagnostics.netLabel} {formatItemRateLabel(entry.itemId, entry.netRatePerMin, locale, catalog?.powerItemId)}</span>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 100 }}>
        <button
          type="button"
          aria-pressed={isFocused}
          onClick={() =>
            isFocused
              ? removeFocusItem(entry.itemId)
              : addFocusItem(entry.itemId)
          }
          style={focusButtonStyle}
        >
          {isFocused
            ? bundle.focusFilter.removeFocusButton
            : bundle.focusFilter.addFocusButton}
        </button>
        <button
          type="button"
          onClick={() =>
            entry.isRawInput
              ? unmarkItemAsRawInput(entry.itemId)
              : markItemAsRawInput(entry.itemId)
          }
          style={compactLedgerButtonStyle}
        >
          {entry.isRawInput
            ? bundle.itemLedger.unmarkRawButton
            : bundle.itemLedger.markRawButton}
        </button>
      </div>
    </div>
  );
});

const ItemLedgerSection = React.memo(function ItemLedgerSection({
  section,
}: ItemLedgerSectionProps) {
  const { bundle } = useCatalog();
  const focusResult = useFocusFilter();

  if (!focusResult) {
    return (
      <>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(24, 51, 89, 0.72)' }}>
          {section.title}
        </div>
        {section.items.length === 0 ? (
          <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>{bundle.itemLedger.noItems}</div>
        ) : (
          <div style={{ display: 'grid', gap: 0, borderTop: '1px solid rgba(24, 51, 89, 0.10)' }}>
            {section.items.map(entry => (
              <ItemRow key={entry.itemId} entry={entry} />
            ))}
          </div>
        )}
      </>
    );
  }

  const { focused, unfocused } = splitByFocus(section.items, entry => focusResult.focusedItemIds.has(entry.itemId));

  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(24, 51, 89, 0.72)' }}>
        {section.title}
      </div>
      {focused.length === 0 && unfocused.length === 0 ? (
        <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>{bundle.itemLedger.noItems}</div>
      ) : (
        <div style={{ display: 'grid', gap: 0, borderTop: '1px solid rgba(24, 51, 89, 0.10)' }}>
          {focused.map(entry => (
            <ItemRow key={entry.itemId} entry={entry} />
          ))}
          {unfocused.length > 0 ? (
            <>
              {focused.length > 0 ? (
                <div style={focusDividerStyle}>
                  <span style={focusDividerLabelStyle}>{bundle.focusFilter.unfocusedSectionTitle}</span>
                </div>
              ) : null}
              {unfocused.map(entry => (
                <ItemRow key={entry.itemId} entry={entry} dimmed />
              ))}
            </>
          ) : null}
        </div>
      )}
    </>
  );
});

export default ItemLedgerSection;
