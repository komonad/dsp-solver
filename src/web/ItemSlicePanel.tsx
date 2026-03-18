import React from 'react';
import { formatPower, formatRate, getLocaleBundle, type AppLocale } from '../i18n';
import { getWorkbenchExtraBundle } from '../i18n/workbenchExtra';
import type { PresentationItemRate, PresentationItemSlice } from '../presentation';
import { EntityLabel } from './EntityIcon';

interface ItemSlicePanelProps {
  locale: AppLocale;
  atlasIds?: string[];
  slice?: PresentationItemSlice;
  preferredRecipeId?: string;
  preferredRecipeOptions: Array<{
    recipeId: string;
    recipeName: string;
    recipeIconKey?: string;
  }>;
  onSelectItem: (itemId: string) => void;
  onMarkRaw: (itemId: string) => void;
  onUnmarkRaw: (itemId: string) => void;
  onPreferredRecipeChange: (itemId: string, recipeId: string) => void;
  onClearPreferredRecipe: (itemId: string) => void;
  onLocateInLedger: (itemId: string) => void;
}

const sectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: 'rgba(24, 51, 89, 0.68)',
};

const valueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 16,
  fontWeight: 700,
};

const buttonStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.16)',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: 'rgba(24, 51, 89, 0.08)',
  color: '#183359',
};

const textButtonStyle: React.CSSProperties = {
  border: 'none',
  padding: 0,
  margin: 0,
  background: 'transparent',
  color: '#183359',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};

function renderRateList(
  items: PresentationItemRate[],
  locale: AppLocale,
  onSelectItem: (itemId: string) => void,
  atlasIds?: string[]
) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => (
        <button
          key={item.itemId}
          type="button"
          onClick={() => onSelectItem(item.itemId)}
          style={{
            ...textButtonStyle,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: 999,
            padding: '6px 10px',
            background: 'rgba(24, 51, 89, 0.06)',
          }}
        >
          <EntityLabel
            label={item.itemName}
            iconKey={item.iconKey}
            atlasIds={atlasIds}
            size={18}
            gap={6}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
          <span style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.72)' }}>
            {formatRate(item.ratePerMin, locale)}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function ItemSlicePanel(props: ItemSlicePanelProps) {
  const {
    locale,
    atlasIds,
    slice,
    preferredRecipeId,
    preferredRecipeOptions,
    onSelectItem,
    onMarkRaw,
    onUnmarkRaw,
    onPreferredRecipeChange,
    onClearPreferredRecipe,
    onLocateInLedger,
  } = props;
  const bundle = getWorkbenchExtraBundle(locale);
  const localeBundle = getLocaleBundle(locale);

  if (!slice) {
    return (
      <section style={sectionStyle}>
        <h3 style={{ margin: 0 }}>{bundle.itemSlice.title}</h3>
        <div
          style={{
            borderRadius: 16,
            padding: 16,
            background: 'rgba(24, 51, 89, 0.04)',
            color: 'rgba(24, 51, 89, 0.72)',
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 700, color: '#183359' }}>{bundle.itemSlice.emptyTitle}</div>
          <div style={{ marginTop: 8 }}>{bundle.itemSlice.emptyDescription}</div>
        </div>
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={smallLabelStyle}>{bundle.itemSlice.title}</div>
          <div style={{ marginTop: 6 }}>
            <EntityLabel
              label={slice.itemName}
              iconKey={slice.iconKey}
              atlasIds={atlasIds}
              size={26}
              gap={10}
              textStyle={{ fontSize: 20, fontWeight: 700 }}
            />
          </div>
        </div>
        <button type="button" onClick={() => onLocateInLedger(slice.itemId)} style={buttonStyle}>
          {bundle.itemSlice.openInLedgerButton}
        </button>
      </div>

      <div style={summaryGridStyle}>
        <div>
          <div style={smallLabelStyle}>{bundle.itemSlice.summaryTitle}</div>
          <div style={valueStyle}>{formatRate(slice.producedRatePerMin, locale)}</div>
          <div style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.72)' }}>
            {localeBundle.diagnostics.producedLabel}
          </div>
        </div>
        <div>
          <div style={smallLabelStyle}>&nbsp;</div>
          <div style={valueStyle}>{formatRate(slice.consumedRatePerMin, locale)}</div>
          <div style={{ fontSize: 12, color: 'rgba(24, 51, 89, 0.72)' }}>
            {localeBundle.diagnostics.consumedLabel}
          </div>
        </div>
        <div>
          <div style={smallLabelStyle}>{localeBundle.diagnostics.netLabel}</div>
          <div style={valueStyle}>{formatRate(slice.netRatePerMin, locale)}</div>
        </div>
        <div>
          <div style={smallLabelStyle}>{bundle.itemSlice.targetRateLabel}</div>
          <div style={valueStyle}>{formatRate(slice.targetRatePerMin, locale)}</div>
        </div>
        <div>
          <div style={smallLabelStyle}>{bundle.itemSlice.externalInputLabel}</div>
          <div style={valueStyle}>{formatRate(slice.externalInputRatePerMin, locale)}</div>
        </div>
        <div>
          <div style={smallLabelStyle}>{bundle.itemSlice.surplusLabel}</div>
          <div style={valueStyle}>{formatRate(slice.surplusRatePerMin, locale)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={smallLabelStyle}>{bundle.itemSlice.preferredRecipeLabel}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {slice.isRawInput ? (
          <button type="button" onClick={() => onUnmarkRaw(slice.itemId)} style={buttonStyle}>
            {localeBundle.itemLedger.unmarkRawButton}
          </button>
        ) : (
          <button type="button" onClick={() => onMarkRaw(slice.itemId)} style={buttonStyle}>
            {localeBundle.itemLedger.markRawButton}
          </button>
        )}

        <select
          value={preferredRecipeId ?? ''}
          onChange={event => onPreferredRecipeChange(slice.itemId, event.target.value)}
          style={{
            minHeight: 38,
            borderRadius: 12,
            border: '1px solid rgba(24, 51, 89, 0.16)',
            padding: '8px 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'rgba(255,255,255,0.94)',
            color: '#183359',
            minWidth: 180,
          }}
        >
          <option value="">{bundle.itemSlice.noPreferredRecipe}</option>
          {preferredRecipeOptions.map(option => (
            <option key={option.recipeId} value={option.recipeId}>
              {option.recipeName}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onClearPreferredRecipe(slice.itemId)}
          style={buttonStyle}
          disabled={!preferredRecipeId}
        >
          {bundle.itemSlice.clearPreferredRecipeButton}
        </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={smallLabelStyle}>{bundle.itemSlice.producersTitle}</div>
        {slice.producerPlans.length > 0 ? (
          slice.producerPlans.map(plan => (
            <article
              key={`producer-${slice.itemId}-${plan.recipeId}-${plan.buildingId}-${plan.proliferatorLabel}`}
              style={{
                display: 'grid',
                gap: 10,
                borderRadius: 16,
                padding: 14,
                background: 'rgba(24, 51, 89, 0.04)',
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <EntityLabel
                  label={`${plan.recipeName} / ${plan.buildingName}`}
                  iconKey={plan.recipeIconKey}
                  size={22}
                  gap={8}
                  textStyle={{ fontWeight: 700 }}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'rgba(24, 51, 89, 0.72)' }}>
                  <span>产出 {formatRate(plan.itemRatePerMin, locale)}</span>
                  <span>{plan.proliferatorLabel}</span>
                  <span>{plan.roundedUpBuildingCount} 台</span>
                  <span>{formatPower(plan.roundedPlacementPowerMW, locale)}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={smallLabelStyle}>{localeBundle.recipePlans.inputsLabel}</div>
                {renderRateList(plan.inputs, locale, onSelectItem, atlasIds)}
                <div style={smallLabelStyle}>{localeBundle.recipePlans.outputsLabel}</div>
                {renderRateList(plan.outputs, locale, onSelectItem, atlasIds)}
              </div>
            </article>
          ))
        ) : (
          <div style={{ color: 'rgba(24, 51, 89, 0.72)', lineHeight: 1.6 }}>
            {bundle.itemSlice.noProducerPlans}
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={smallLabelStyle}>{bundle.itemSlice.consumersTitle}</div>
        {slice.consumerPlans.length > 0 ? (
          slice.consumerPlans.map(plan => (
            <article
              key={`consumer-${slice.itemId}-${plan.recipeId}-${plan.buildingId}-${plan.proliferatorLabel}`}
              style={{
                display: 'grid',
                gap: 10,
                borderRadius: 16,
                padding: 14,
                background: 'rgba(24, 51, 89, 0.04)',
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <EntityLabel
                  label={`${plan.recipeName} / ${plan.buildingName}`}
                  iconKey={plan.recipeIconKey}
                  atlasIds={atlasIds}
                  size={22}
                  gap={8}
                  textStyle={{ fontWeight: 700 }}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'rgba(24, 51, 89, 0.72)' }}>
                  <span>消耗 {formatRate(plan.itemRatePerMin, locale)}</span>
                  <span>{plan.proliferatorLabel}</span>
                  <span>{plan.roundedUpBuildingCount} 台</span>
                  <span>{formatPower(plan.roundedPlacementPowerMW, locale)}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={smallLabelStyle}>{localeBundle.recipePlans.inputsLabel}</div>
                {renderRateList(plan.inputs, locale, onSelectItem, atlasIds)}
                <div style={smallLabelStyle}>{localeBundle.recipePlans.outputsLabel}</div>
                {renderRateList(plan.outputs, locale, onSelectItem, atlasIds)}
              </div>
            </article>
          ))
        ) : (
          <div style={{ color: 'rgba(24, 51, 89, 0.72)', lineHeight: 1.6 }}>
            {bundle.itemSlice.noConsumerPlans}
          </div>
        )}
      </div>
    </section>
  );
}
