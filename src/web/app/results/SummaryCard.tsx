import React from 'react';
import { formatRate, formatPower, type AppLocale } from '../../../i18n';
import { EntityLabel } from '../../shared/EntityIcon';
import { ClickableItemLabel } from '../components/ClickableItemLabel';
import { useWorkbench } from '../WorkbenchContext';
import { cardStyle, sectionHeadingStyle } from '../workbenchStyles';

const summarySectionStyle: React.CSSProperties = {
  border: '1px solid rgba(24, 51, 89, 0.10)',
  borderRadius: 16,
  padding: 14,
  display: 'grid',
  gap: 8,
  alignContent: 'start',
};

const summaryRateListStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};

const summaryRateTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(24, 51, 89, 0.72)',
  whiteSpace: 'nowrap',
};

const surplusGroupLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(24, 51, 89, 0.62)',
  whiteSpace: 'nowrap',
};

export interface SummaryItemRateListProps {
  items: Array<{
    itemId: string;
    itemName: string;
    iconKey?: string;
    ratePerMin: number;
  }>;
  locale: AppLocale;
  atlasIds: string[];
}

export function SummaryItemRateList({
  items,
  locale,
  atlasIds,
}: SummaryItemRateListProps) {
  return (
    <div style={summaryRateListStyle}>
      {items.map(item => (
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
            atlasIds={atlasIds}
          />
          <span style={summaryRateTextStyle}>{formatRate(item.ratePerMin, locale)}</span>
        </div>
      ))}
    </div>
  );
}

export default function SummaryCard() {
  const { bundle, locale, iconAtlasIds, model } = useWorkbench();

  if (!model) {
    return null;
  }

  const netInputItems = model.solvedSummary?.netInputs ?? [];
  const targetOutputItems = model.solvedSummary
    ? model.targets.map(target => ({
        itemId: target.itemId,
        itemName: target.itemName,
        iconKey: target.iconKey,
        ratePerMin: target.actualRatePerMin,
      }))
    : [];
  const surplusOutputItems = model.solvedSummary ? model.surplusOutputs : [];
  const hasNetOutputs = targetOutputItems.length > 0 || surplusOutputItems.length > 0;

  return (
    <article style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>{bundle.overview.summaryTitle}</h2>
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
        }}
      >
        <div style={summarySectionStyle}>
          <div style={sectionHeadingStyle}>{bundle.itemLedger.netInputsTitle}</div>
          {netInputItems.length === 0 ? (
            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
          ) : (
            <SummaryItemRateList items={netInputItems} locale={locale} atlasIds={iconAtlasIds} />
          )}
        </div>

        <div style={summarySectionStyle}>
          <div style={sectionHeadingStyle}>{bundle.itemLedger.netOutputsTitle}</div>
          {!hasNetOutputs ? (
            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.common.none}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {targetOutputItems.length > 0 ? (
                <SummaryItemRateList items={targetOutputItems} locale={locale} atlasIds={iconAtlasIds} />
              ) : null}
              {surplusOutputItems.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                    borderTop: targetOutputItems.length > 0 ? '1px solid rgba(24, 51, 89, 0.12)' : undefined,
                    paddingTop: targetOutputItems.length > 0 ? 8 : 0,
                  }}
                >
                  <div style={surplusGroupLabelStyle}>{bundle.overview.surplusOutputsTitle}</div>
                  <SummaryItemRateList
                    items={surplusOutputItems}
                    locale={locale}
                    atlasIds={iconAtlasIds}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div
          style={{
            ...summarySectionStyle,
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

        <div style={{ ...summarySectionStyle, gap: 6 }}>
          <div style={sectionHeadingStyle}>{bundle.overview.powerLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatPower(model.solvedSummary?.roundedPlacementPowerMW ?? 0, locale)}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>
            {bundle.overview.roundedPlacementLabel}
          </div>
        </div>

        <div style={{ ...summarySectionStyle, gap: 6 }}>
          <div style={sectionHeadingStyle}>{bundle.summary.recipesLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{model.solvedSummary?.recipeTypeCount ?? 0}</div>
          <div style={{ fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>{bundle.recipePlans.title}</div>
        </div>
      </div>
    </article>
  );
}
