import React from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import SolveActivityNotice from '../components/SolveActivityNotice';
import SummaryCard from './SummaryCard';
import DiagnosticsCard from './DiagnosticsCard';
import RecipePlanList from './RecipePlanList';
import ItemLedgerPanel from './ItemLedgerPanel';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import { cardStyle, resultBodyGridStyle, resultMainColumnStyle } from '../workbenchStyles';

export default function ResultsArea() {
  const { bundle } = useCatalog();
  const { model, autoSolveState } = useSolve();
  const theme = useTheme();
  const isMobileLayout = useMediaQuery(theme.breakpoints.down('md'));
  const isTabletLayout = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isSolveRunning = autoSolveState.activity.status === 'running';
  const isSolveCancelled = autoSolveState.activity.status === 'cancelled';

  if (!model) {
    if (isSolveRunning || isSolveCancelled) {
      return (
        <article style={cardStyle}>
          <SolveActivityNotice />
        </article>
      );
    }

    return (
      <article style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>{bundle.datasetSource.waitingTitle}</h2>
        <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
          {bundle.datasetSource.waitingDescription}
        </p>
      </article>
    );
  }

  if (!model.status) {
    if (isSolveRunning || isSolveCancelled) {
      return (
        <article style={cardStyle}>
          <SolveActivityNotice />
        </article>
      );
    }

    return (
      <article style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>{bundle.ready.title}</h2>
        <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
          {bundle.ready.description}
        </p>
      </article>
    );
  }

  const activitySection =
    isSolveRunning || isSolveCancelled ? (
      <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
        <article style={{ ...cardStyle, padding: 12 }}>
          <SolveActivityNotice />
        </article>
      </div>
    ) : null;

  if (isMobileLayout) {
    return (
      <section style={{ display: 'grid', gap: 16 }}>
        {activitySection}
        <SummaryCard />
        <DiagnosticsCard />
        <article style={{ ...cardStyle, width: '100%', maxWidth: 'none' }}>
          <h2 style={{ marginTop: 0 }}>{bundle.recipePlans.title}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <RecipePlanList />
          </div>
        </article>
        <ItemLedgerPanel sticky={false} />
      </section>
    );
  }

  if (isTabletLayout) {
    return (
      <section
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.35fr)',
          alignItems: 'start',
        }}
      >
        {activitySection}

        <div style={{ ...resultMainColumnStyle, gridColumn: '1', minWidth: 0 }}>
          <SummaryCard />
          <DiagnosticsCard />
        </div>

        <div style={{ gridColumn: '2', minWidth: 0 }}>
          <article style={{ ...cardStyle, width: '100%', maxWidth: 'none', justifySelf: 'stretch' }}>
            <h2 style={{ marginTop: 0 }}>{bundle.recipePlans.title}</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <RecipePlanList />
            </div>
          </article>
        </div>

        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <ItemLedgerPanel sticky={false} />
        </div>
      </section>
    );
  }

  return (
    <section style={resultBodyGridStyle}>
      {activitySection}

      <div style={{ ...resultMainColumnStyle, gridColumn: '1', gridRow: '1 / span 2', minWidth: 0 }}>
        <SummaryCard />
        <DiagnosticsCard />
      </div>

      <div style={{ gridColumn: '2', gridRow: '1 / span 2', minWidth: 0 }}>
        <article style={{ ...cardStyle, width: '100%', maxWidth: 'none', justifySelf: 'stretch' }}>
          <h2 style={{ marginTop: 0 }}>{bundle.recipePlans.title}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <RecipePlanList />
          </div>
        </article>
      </div>

      <ItemLedgerPanel sticky />
    </section>
  );
}
