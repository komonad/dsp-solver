import React from 'react';
import SummaryCard from './SummaryCard';
import DiagnosticsCard from './DiagnosticsCard';
import RecipePlanList from './RecipePlanList';
import ItemLedgerPanel from './ItemLedgerPanel';
import { useWorkbench } from '../WorkbenchContext';
import { cardStyle, resultBodyGridStyle, resultMainColumnStyle } from '../workbenchStyles';

export default function ResultsArea() {
  const { bundle, model } = useWorkbench();

  if (!model) {
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
    return (
      <article style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>{bundle.ready.title}</h2>
        <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
          {bundle.ready.description}
        </p>
      </article>
    );
  }

  return (
    <section style={resultBodyGridStyle}>
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

      <ItemLedgerPanel />
    </section>
  );
}
