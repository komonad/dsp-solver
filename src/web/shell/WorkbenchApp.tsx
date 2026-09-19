import { Box, Button, Container } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useState } from 'react';
import ItemSliceOverlayHost from '../itemSlice/ItemSliceOverlayHost';
import { WorkbenchProvider, useWorkbench } from '../app/WorkbenchContext';
import { useWorkbenchDraft } from '../app/WorkbenchDraftContext';
import { useCatalog } from '../app/CatalogContext';
import { useSolve } from '../app/SolveContext';
import WorkbenchConfigStrip from '../app/WorkbenchConfigStrip';
import SettingsSidebar from './SettingsSidebar';
import SolveActivityNotice from '../app/components/SolveActivityNotice';
import CollapsibleCardHeader from '../app/components/CollapsibleCardHeader';
import SummaryCard from '../app/results/SummaryCard';
import DiagnosticsCard from '../app/results/DiagnosticsCard';
import RecipePlanList from '../app/results/RecipePlanList';
import FocusFilterBar from '../app/results/FocusFilterBar';
import ItemLedgerPanel from '../app/results/ItemLedgerPanel';
import StrategyWarningSnackbar from '../app/StrategyWarningSnackbar';
import { FlowGraphPanel } from '../app/flowGraph/FlowGraphPanel';
import WorkbenchHeader from './WorkbenchHeader';
import ResizableWorkbenchLayout from './ResizableWorkbenchLayout';
import { cardStyle } from '../app/workbenchStyles';

export default function WorkbenchApp() {
  return (
    <WorkbenchProvider>
      <WorkbenchLayout />
    </WorkbenchProvider>
  );
}

function WorkbenchLayout() {
  const {
    bundle,
    locale,
    catalog,
    iconAtlasIds,
    preferredRecipeOptionsByItem,
  } = useCatalog();
  const { model, autoSolveState } = useSolve();
  const {
    loadError,
    allowedRecipesByItem,
    markItemAsRawInput,
    unmarkItemAsRawInput,
    applyAllowedRecipesForItem,
    clearAllowedRecipesForItem,
    locateItemInLedger,
  } = useWorkbench();
  const { revealRecipePlan, focusItemIds, addFocusItem, removeFocusItem, viewRawInputItemIds, addViewRawInput, removeViewRawInput } = useWorkbenchDraft();
  const isSolveRunning = autoSolveState.activity.status === 'running';
  const isSolveCancelled = autoSolveState.activity.status === 'cancelled';

  const hasStatus = !!model?.status;
  const hasModel = !!model;
  const [recipePlansCollapsed, setRecipePlansCollapsed] = useState(false);
  const [flowGraphOpen, setFlowGraphOpen] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <WorkbenchHeader />
      <Container component="main" maxWidth={false} sx={{
        py: { xs: 2, md: 2 }, px: { xs: 1.5, sm: 2, md: 2.5 },
        display: 'grid', gap: 2,
      }}>
        <WorkbenchConfigStrip />
        <ResizableWorkbenchLayout
          left={hasStatus ? <><SummaryCard /><ItemLedgerPanel sticky={false} /><DiagnosticsCard /></> : null}
          right={<SettingsSidebar />}>
          <Box sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
            {isSolveRunning || isSolveCancelled ? (
              <article style={cardStyle}><SolveActivityNotice /></article>
            ) : null}
            {loadError ? (
              <article style={{ ...cardStyle, borderColor: 'rgba(180, 41, 41, 0.2)' }}>
                <h2 style={{ marginTop: 0, color: '#8e2020' }}>{bundle.datasetSource.loadErrorTitle}</h2>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{loadError}</pre>
              </article>
            ) : null}
            {hasStatus ? (
              <>
                <FocusFilterBar />
                <article style={cardStyle}>
                  <CollapsibleCardHeader title={bundle.recipePlans.title} collapsed={recipePlansCollapsed}
                    onToggle={() => setRecipePlansCollapsed(prev => !prev)}
                    summary={model?.recipePlans ? `${model.recipePlans.length}` : undefined}
                    actions={model?.recipePlans.length ? (
                      <Button variant="outlined" size="small" onClick={() => setFlowGraphOpen(true)} startIcon={<AccountTreeOutlinedIcon />}>
                        {bundle.flowGraph.title}
                      </Button>
                    ) : undefined} />
                  {!recipePlansCollapsed ? (
                    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}><RecipePlanList /></div>
                  ) : null}
                </article>
              </>
            ) : null}
            {!hasModel && !isSolveRunning && !isSolveCancelled && !loadError ? (
              <article style={{ ...cardStyle, padding: 32 }}>
                <h2 style={{ marginTop: 0 }}>{bundle.datasetSource.waitingTitle}</h2>
                <p style={{ margin: 0, lineHeight: 1.8, color: '#69778e' }}>{bundle.datasetSource.waitingDescription}</p>
              </article>
            ) : null}
            {hasModel && !hasStatus && !isSolveRunning && !isSolveCancelled ? (
              <article style={{ ...cardStyle, padding: 32 }}>
                <h2 style={{ marginTop: 0 }}>{bundle.ready.title}</h2>
                <p style={{ margin: 0, lineHeight: 1.8, color: '#69778e' }}>{bundle.ready.description}</p>
              </article>
            ) : null}
          </Box>
        </ResizableWorkbenchLayout>
        <ItemSliceOverlayHost
          locale={locale}
          atlasIds={iconAtlasIds}
          powerItemId={catalog?.powerItemId}
          itemSlicesById={model?.itemSlicesById ?? {}}
          allowedRecipesByItem={allowedRecipesByItem}
          allowedRecipeOptionsByItem={preferredRecipeOptionsByItem}
          focusItemIds={focusItemIds}
          viewRawInputItemIds={viewRawInputItemIds}
          onToggleViewRawInput={itemId => viewRawInputItemIds.includes(itemId) ? removeViewRawInput(itemId) : addViewRawInput(itemId)}
          onMarkRaw={markItemAsRawInput}
          onUnmarkRaw={unmarkItemAsRawInput}
          onAddFocus={addFocusItem}
          onRemoveFocus={removeFocusItem}
          onApplyPreferredRecipes={applyAllowedRecipesForItem}
          onClearAllowedRecipes={clearAllowedRecipesForItem}
          onLocateInLedger={locateItemInLedger}
          onRevealRecipePlan={revealRecipePlan}
        />
        <StrategyWarningSnackbar />

      </Container>
      {flowGraphOpen && model?.recipePlans.length ? (
        <FlowGraphPanel
          recipePlans={model.recipePlans}
          catalog={catalog}
          model={model}
          locale={locale}
          title={bundle.flowGraph.title}
          onClose={() => setFlowGraphOpen(false)}
        />
      ) : null}
    </Box>
  );
}
