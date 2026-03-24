import React from 'react';
import { formatRate } from '../../i18n';
import type { PresentationModel } from '../../presentation';
import { EntityLabelButton } from '../shared/EntityIcon';
import { openItemSliceOverlay } from '../itemSlice/itemSliceStore';
import { useWorkbench } from './WorkbenchContext';
import { compactLedgerButtonStyle } from './workbenchStyles';

export interface ItemLedgerSectionProps {
  section: PresentationModel['itemLedgerSections'][number];
}

const ItemLedgerSection = React.memo(function ItemLedgerSection({
  section,
}: ItemLedgerSectionProps) {
  const {
    bundle,
    locale,
    iconAtlasIds,
    markItemAsRawInput,
    unmarkItemAsRawInput,
  } = useWorkbench();

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
            <div
              key={entry.itemId}
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
                  <span>{bundle.diagnostics.producedLabel} {formatRate(entry.producedRatePerMin, locale)}</span>
                  <span>{bundle.diagnostics.consumedLabel} {formatRate(entry.consumedRatePerMin, locale)}</span>
                  {Math.abs(entry.netRatePerMin) > 1e-8 ? (
                    <span>{bundle.diagnostics.netLabel} {formatRate(entry.netRatePerMin, locale)}</span>
                  ) : null}
                </div>
              </div>
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
          ))}
        </div>
      )}
    </>
  );
});

export default ItemLedgerSection;
