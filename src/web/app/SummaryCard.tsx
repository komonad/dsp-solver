import React from 'react';
import { formatRate, formatPower } from '../../i18n';
import { EntityLabel } from '../shared/EntityIcon';
import { ClickableItemLabel } from './ClickableItemLabel';
import { FlowRateSequence } from './FlowRateDisplay';
import { useWorkbench } from './WorkbenchContext';
import { cardStyle, sectionHeadingStyle } from './workbenchStyles';

export default function SummaryCard() {
  const { bundle, locale, iconAtlasIds, model } = useWorkbench();

  if (!model) {
    return null;
  }

  return (
    <article style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>{bundle.overview.summaryTitle}</h2>
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={sectionHeadingStyle}>{bundle.itemLedger.netInputsTitle}</div>
          {(model.solvedSummary?.netInputs.length ?? 0) === 0 ? (
            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {model.solvedSummary?.netInputs.map(item => (
                <div
                  key={item.itemId}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title={`${item.itemName}: ${formatRate(item.ratePerMin, locale)}`}
                >
                  <ClickableItemLabel
                    itemId={item.itemId}
                    itemName={item.itemName}
                    iconKey={item.iconKey}
                    iconOnly
                    iconSize={18}
                    atlasIds={iconAtlasIds}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.72)', whiteSpace: 'nowrap' }}>
                    {formatRate(item.ratePerMin, locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={sectionHeadingStyle}>{bundle.itemLedger.netOutputsTitle}</div>
          {(model.solvedSummary?.netOutputs.length ?? 0) === 0 ? (
            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {model.solvedSummary?.netOutputs.map(item => (
                <div
                  key={item.itemId}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title={`${item.itemName}: ${formatRate(item.ratePerMin, locale)}`}
                >
                  <ClickableItemLabel
                    itemId={item.itemId}
                    itemName={item.itemName}
                    iconKey={item.iconKey}
                    iconOnly
                    iconSize={18}
                    atlasIds={iconAtlasIds}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.72)', whiteSpace: 'nowrap' }}>
                    {formatRate(item.ratePerMin, locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            border: '1px solid rgba(24, 51, 89, 0.10)',
            borderRadius: 16,
            padding: 14,
            display: 'grid',
            gap: 10,
            alignContent: 'start',
            gridColumn: 'span 2',
          }}
        >
          <div style={sectionHeadingStyle}>{bundle.summary.buildingsLabel}</div>
          {model.buildingSummary.length === 0 ? (
            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {model.buildingSummary.map(summary => (
                <div
                  key={summary.buildingId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <EntityLabel
                      label={summary.buildingName}
                      iconKey={summary.buildingIconKey}
                      atlasIds={iconAtlasIds}
                      size={18}
                      gap={8}
                      textStyle={{ fontWeight: 600 }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'rgba(24, 51, 89, 0.78)',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                  >
                    {summary.exactCount.toFixed(2)} / {summary.roundedUpCount}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.62)' }}>
            {bundle.recipePlans.exactLabel} / {bundle.overview.roundedLabel}
          </div>
        </div>

        <div style={{ border: '1px solid rgba(24, 51, 89, 0.10)', borderRadius: 16, padding: 14, display: 'grid', gap: 6, alignContent: 'start' }}>
          <div style={sectionHeadingStyle}>{bundle.overview.powerLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatPower(model.solvedSummary?.roundedPlacementPowerMW ?? 0, locale)}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>
            {bundle.overview.roundedPlacementLabel}
          </div>
        </div>

        <div style={{ border: '1px solid rgba(24, 51, 89, 0.10)', borderRadius: 16, padding: 14, display: 'grid', gap: 6, alignContent: 'start' }}>
          <div style={sectionHeadingStyle}>{bundle.summary.recipesLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{model.solvedSummary?.recipeTypeCount ?? 0}</div>
          <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>{bundle.recipePlans.title}</div>
        </div>
      </div>
    </article>
  );
}
