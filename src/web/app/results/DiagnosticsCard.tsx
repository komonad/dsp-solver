import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { formatRate } from '../../../i18n';
import { copyText } from '../../shared/copyText';
import { ClickableItemLabel } from '../components/ClickableItemLabel';
import { FlowRateSequence } from '../components/FlowRateDisplay';
import { useWorkbench } from '../WorkbenchContext';
import { cardStyle } from '../workbenchStyles';
import SolveAuditSection from './SolveAuditSection';

export default function DiagnosticsCard() {
  const {
    bundle,
    locale,
    iconAtlasIds,
    model,
    fallbackModel,
    fallbackSolve,
    lastRequest,
    result,
    applyAllowSurplusFallback,
  } = useWorkbench();
  const requestJsonText = useMemo(
    () => (lastRequest ? JSON.stringify(lastRequest, null, 2) : ''),
    [lastRequest]
  );
  const [copyRequestState, setCopyRequestState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [requestJsonHovered, setRequestJsonHovered] = useState(false);

  const copySolveRequestJson = useCallback(async () => {
    if (!requestJsonText) {
      return;
    }
    if (await copyText(requestJsonText)) {
      setCopyRequestState('copied');
    } else {
      setCopyRequestState('failed');
    }
  }, [requestJsonText]);

  useEffect(() => {
    setCopyRequestState('idle');
  }, [requestJsonText]);

  useEffect(() => {
    if (copyRequestState === 'idle') {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setCopyRequestState('idle'), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyRequestState]);

  if (!model) {
    return null;
  }

  const copyRequestButtonLabel =
    copyRequestState === 'copied'
      ? bundle.diagnostics.copySolveRequestJsonDone
      : copyRequestState === 'failed'
        ? bundle.diagnostics.copySolveRequestJsonFailed
        : bundle.diagnostics.copySolveRequestJson;
  const showCopyRequestButton = requestJsonHovered || copyRequestState !== 'idle';

  return (
    <article style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>{bundle.diagnostics.title}</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <SolveAuditSection bundle={bundle} locale={locale} solveAudit={result?.solveAudit} />
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
                  <FlowRateSequence items={fallbackModel.solvedSummary.netInputs} locale={locale} atlasIds={iconAtlasIds} noneText={bundle.common.none} />
                </div>
              ) : null}
              {fallbackModel.surplusOutputs.length ? (
                <div>
                  <strong>{bundle.diagnostics.fallbackSurplusLabel}</strong>{' '}
                  <FlowRateSequence items={fallbackModel.surplusOutputs} locale={locale} atlasIds={iconAtlasIds} noneText={bundle.common.none} />
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
                  atlasIds={iconAtlasIds}
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
        <div
          style={{ marginTop: 12, position: 'relative' }}
          onMouseEnter={() => setRequestJsonHovered(true)}
          onMouseLeave={() => setRequestJsonHovered(false)}
        >
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={copySolveRequestJson}
              disabled={!requestJsonText}
              sx={{
                minWidth: 0,
                px: 1.1,
                py: 0.25,
                fontSize: 12,
                lineHeight: 1.4,
                boxShadow: 'none',
                opacity: showCopyRequestButton ? 1 : 0,
                transform: showCopyRequestButton ? 'translateY(0)' : 'translateY(-4px)',
                pointerEvents: showCopyRequestButton ? 'auto' : 'none',
                transition: 'opacity 120ms ease, transform 120ms ease',
              }}
            >
              {copyRequestButtonLabel}
            </Button>
          </div>
          <pre style={{ margin: 0, padding: 12, borderRadius: 14, background: 'rgba(24, 51, 89, 0.06)', overflow: 'auto', fontSize: 13 }}>
            {requestJsonText}
          </pre>
        </div>
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
