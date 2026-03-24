import React from 'react';
import { Alert, Button } from '@mui/material';
import { formatRate } from '../../i18n';
import { ClickableItemLabel } from './ClickableItemLabel';
import { FlowRateSequence } from './FlowRateDisplay';
import { useWorkbench } from './WorkbenchContext';
import { cardStyle } from './workbenchStyles';

export default function DiagnosticsCard() {
  const {
    bundle,
    locale,
    model,
    fallbackModel,
    fallbackSolve,
    lastRequest,
    result,
    applyAllowSurplusFallback,
  } = useWorkbench();

  if (!model) {
    return null;
  }

  return (
    <article style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>{bundle.diagnostics.title}</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {fallbackModel && fallbackSolve?.reason === 'force_balance_infeasible' ? (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={applyAllowSurplusFallback}>
                {bundle.diagnostics.fallbackApplyButton}
              </Button>
            }
          >
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>
                {bundle.diagnostics.fallbackTitle}
              </div>
              <div>{bundle.diagnostics.fallbackDescription}</div>
              {fallbackModel.solvedSummary?.netInputs.length ? (
                <div>
                  <strong>{bundle.diagnostics.fallbackNetInputsLabel}</strong>{' '}
                  <FlowRateSequence items={fallbackModel.solvedSummary.netInputs} />
                </div>
              ) : null}
              {fallbackModel.surplusOutputs.length ? (
                <div>
                  <strong>{bundle.diagnostics.fallbackSurplusLabel}</strong>{' '}
                  <FlowRateSequence items={fallbackModel.surplusOutputs} />
                </div>
              ) : null}
            </div>
          </Alert>
        ) : null}
        {model.diagnostics &&
        model.diagnostics.messages.length === 0 &&
        model.diagnostics.infoMessages.length === 0 &&
        model.diagnostics.unmetPreferences.length === 0 ? (
          <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>{bundle.diagnostics.noDiagnostics}</div>
        ) : (
          <>
            {(model.diagnostics?.messages ?? []).map((message, index) => (
              <div key={`message-${index}`}>{message}</div>
            ))}
            {(model.diagnostics?.infoMessages ?? []).map((message, index) => (
              <div key={`info-${index}`} style={{ color: 'rgba(24, 51, 89, 0.55)' }}>{message}</div>
            ))}
            {(model.diagnostics?.unmetPreferences ?? []).map((message, index) => (
              <div key={`pref-${index}`}>{message}</div>
            ))}
          </>
        )}
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{bundle.diagnostics.itemBalanceLabel}</summary>
        <div style={{ marginTop: 12, display: 'grid', gap: 6, maxHeight: 260, overflow: 'auto' }}>
          {model.itemBalance.map(entry => (
            <div key={entry.itemId} style={{ paddingBottom: 6, borderBottom: '1px solid rgba(24, 51, 89, 0.08)' }}>
              <div style={{ fontWeight: 700 }}>
                <ClickableItemLabel
                  itemId={entry.itemId}
                  itemName={entry.itemName}
                  iconKey={entry.iconKey}
                />
              </div>
              <div style={{ fontSize: 13 }}>
                {bundle.diagnostics.producedLabel} {formatRate(entry.producedRatePerMin, locale)} / {bundle.diagnostics.consumedLabel} {formatRate(entry.consumedRatePerMin, locale)} / {bundle.diagnostics.netLabel} {formatRate(entry.netRatePerMin, locale)}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{bundle.diagnostics.solveRequestJson}</summary>
        <pre style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'rgba(24, 51, 89, 0.06)', overflow: 'auto', fontSize: 13 }}>
          {JSON.stringify(lastRequest, null, 2)}
        </pre>
      </details>
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{bundle.diagnostics.solveResultJson}</summary>
        <pre style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'rgba(24, 51, 89, 0.06)', overflow: 'auto', fontSize: 13 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </article>
  );
}
