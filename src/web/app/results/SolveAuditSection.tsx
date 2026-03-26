import React from 'react';
import type { AppLocale, LocaleBundle } from '../../../i18n';
import type { SolveAudit } from '../../../solver';

function formatCount(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatRate(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDurationMs(value: number, locale: AppLocale): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: value >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} ms`;
}

function formatModelKind(
  bundle: LocaleBundle,
  modelKind: SolveAudit['attempts'][number]['modelKind']
): string {
  return modelKind === 'milp'
    ? bundle.diagnostics.audit.mixedIntegerProgramLabel
    : bundle.diagnostics.audit.linearProgramLabel;
}

function formatAttemptStatus(bundle: LocaleBundle, status: string): string {
  if (status === 'optimal') {
    return bundle.diagnostics.audit.optimalStatusLabel;
  }
  if (status === 'infeasible') {
    return bundle.diagnostics.audit.infeasibleStatusLabel;
  }
  if (status === 'invalid_input') {
    return bundle.diagnostics.audit.invalidInputStatusLabel;
  }
  return status;
}

function formatAttemptContext(
  bundle: LocaleBundle,
  attempt: SolveAudit['attempts'][number],
  index: number
): string {
  if (attempt.phase === 'reweighted_lp') {
    return bundle.diagnostics.audit.reweightedAttemptTitle(index + 1);
  }
  if (attempt.phase === 'complexity_seed_lp') {
    return bundle.diagnostics.audit.complexitySeedAttemptTitle;
  }
  if (attempt.phase === 'complexity_milp') {
    return bundle.diagnostics.audit.complexityAttemptTitle((attempt.round ?? 0) + 1);
  }
  return bundle.diagnostics.audit.initialAttemptTitle(index + 1);
}

export default function SolveAuditSection(props: {
  locale: AppLocale;
  bundle: LocaleBundle;
  solveAudit?: SolveAudit | null;
}) {
  const { locale, bundle, solveAudit } = props;
  if (!solveAudit) {
    return null;
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: 10,
        padding: 12,
        borderRadius: 14,
        border: '1px solid rgba(24, 51, 89, 0.10)',
        background: 'rgba(24, 51, 89, 0.04)',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontWeight: 700 }}>{bundle.diagnostics.audit.overviewTitle}</div>
        <div style={{ color: 'rgba(24, 51, 89, 0.72)', fontSize: 13, lineHeight: 1.5 }}>
          {bundle.diagnostics.audit.overviewSummary(
            formatCount(solveAudit.prunedItemCount, locale),
            formatCount(solveAudit.prunedRecipeCount, locale),
            formatCount(solveAudit.prunedOptionCount, locale),
            formatCount(solveAudit.resolvedRawInputCount, locale)
          )}
        </div>
        <div style={{ color: 'rgba(24, 51, 89, 0.72)', fontSize: 13, lineHeight: 1.5 }}>
          {bundle.diagnostics.audit.overviewTimings(
            formatDurationMs(solveAudit.totalDurationMs, locale),
            formatDurationMs(solveAudit.graphDurationMs, locale),
            formatDurationMs(solveAudit.modelDurationMs, locale),
            formatDurationMs(solveAudit.solveDurationMs, locale),
            formatDurationMs(solveAudit.resultDurationMs, locale)
          )}
        </div>
      </div>

      {solveAudit.attempts.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {bundle.diagnostics.audit.attemptsTitle}
          </div>
          {solveAudit.attempts.map((attempt, index) => (
            <div
              key={`${attempt.phase}:${attempt.round ?? 0}:${index}`}
              style={{
                display: 'grid',
                gap: 3,
                paddingTop: index === 0 ? 0 : 8,
                borderTop:
                  index === 0 ? 'none' : '1px solid rgba(24, 51, 89, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {bundle.diagnostics.audit.attemptHeading(
                  formatAttemptContext(bundle, attempt, index),
                  formatModelKind(bundle, attempt.modelKind),
                  formatAttemptStatus(bundle, attempt.status)
                )}
              </div>
              <div style={{ color: 'rgba(24, 51, 89, 0.72)', fontSize: 12, lineHeight: 1.5 }}>
                {bundle.diagnostics.audit.attemptModelSummary(
                  formatCount(attempt.itemCount, locale),
                  formatCount(attempt.recipeCount, locale),
                  formatCount(attempt.optionCount, locale),
                  formatCount(attempt.constraintCount, locale),
                  formatCount(attempt.variableCount, locale)
                )}
              </div>
              <div style={{ color: 'rgba(24, 51, 89, 0.72)', fontSize: 12, lineHeight: 1.5 }}>
                {bundle.diagnostics.audit.attemptTimings(
                  formatDurationMs(attempt.buildDurationMs, locale),
                  formatDurationMs(attempt.solveDurationMs, locale),
                  formatDurationMs(attempt.totalDurationMs, locale)
                )}
              </div>
              {attempt.surplusItemCount !== undefined ? (
                <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 12, lineHeight: 1.5 }}>
                  {bundle.diagnostics.audit.attemptSurplus(
                    formatCount(attempt.surplusItemCount, locale),
                    formatRate(attempt.surplusRatePerMin ?? 0, locale)
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
