import { Box, Button, Container } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useState } from 'react';
import ItemSliceOverlayHost from '../itemSlice/ItemSliceOverlayHost';
import { WorkbenchProvider, useWorkbench } from '../app/WorkbenchContext';
import { useWorkbenchDraft } from '../app/WorkbenchDraftContext';
import { useCatalog } from '../app/CatalogContext';
import { useSolve } from '../app/SolveContext';
import WorkbenchConfigStrip from '../app/WorkbenchConfigStrip';
import SolveSnapshotPanel from '../app/snapshot/SolveSnapshotPanel';
import SolveActivityNotice from '../app/components/SolveActivityNotice';
import CollapsibleCardHeader from '../app/components/CollapsibleCardHeader';
import SummaryCard from '../app/results/SummaryCard';
import DiagnosticsCard from '../app/results/DiagnosticsCard';
import RecipePlanList from '../app/results/RecipePlanList';
import ItemLedgerPanel from '../app/results/ItemLedgerPanel';
import StrategyWarningSnackbar from '../app/StrategyWarningSnackbar';
import { FlowGraphPanel } from '../app/flowGraph/FlowGraphPanel';
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
  const { revealRecipePlan } = useWorkbenchDraft();
  const isSolveRunning = autoSolveState.activity.status === 'running';
  const isSolveCancelled = autoSolveState.activity.status === 'cancelled';

  const hasStatus = !!model?.status;
  const hasModel = !!model;
  const [recipePlansCollapsed, setRecipePlansCollapsed] = useState(false);
  const [flowGraphOpen, setFlowGraphOpen] = useState(false);

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        background: '#f4f6f8',
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1560,
          py: { xs: 1, sm: 1.5 },
          px: { xs: 1, sm: 1.5, md: 2.5 },
          display: 'grid',
          gap: { xs: 1.5, md: 2 },
        }}
      >
        {/* 配置切换条 — 全宽 */}
        <WorkbenchConfigStrip />

        {/* 三栏主体 */}
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1.5, lg: 2 },
            gridTemplateColumns: {
              xs: '1fr',
              lg: 'minmax(260px, 1fr) minmax(0, 1.8fr) minmax(280px, 1fr)',
            },
            alignItems: 'start',
          }}
        >
          {/* ── 左栏：结果辅助 ── */}
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 1.5, lg: 2 },
              minWidth: 0,
              order: { xs: 2, lg: 0 },
            }}
          >
            {hasStatus ? (
              <>
                <SummaryCard />
                <ItemLedgerPanel sticky={false} />
                <DiagnosticsCard />
              </>
            ) : null}
          </Box>

          {/* ── 中栏：主舞台 ── */}
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 1.5, lg: 2 },
              minWidth: 0,
              order: { xs: 3, lg: 0 },
            }}
          >
            {/* 求解活动通知 */}
            {isSolveRunning || isSolveCancelled ? (
              <article style={{ ...cardStyle, padding: 12 }}>
                <SolveActivityNotice />
              </article>
            ) : null}

            {/* 加载错误 */}
            {loadError ? (
              <article style={{ ...cardStyle, borderColor: 'rgba(180, 41, 41, 0.2)' }}>
                <h2 style={{ marginTop: 0, color: '#8e2020' }}>{bundle.datasetSource.loadErrorTitle}</h2>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{loadError}</pre>
              </article>
            ) : null}

            {/* 配方方案 */}
            {hasStatus ? (
              <article style={cardStyle}>
                <CollapsibleCardHeader
                  title={bundle.recipePlans.title}
                  collapsed={recipePlansCollapsed}
                  onToggle={() => setRecipePlansCollapsed(prev => !prev)}
                  summary={model?.recipePlans ? `${model.recipePlans.length}` : undefined}
                  actions={model?.recipePlans.length ? (
                    <Button
                      size="small"
                      onClick={() => setFlowGraphOpen(true)}
                      startIcon={<AccountTreeOutlinedIcon sx={{ fontSize: 15 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        px: 1,
                        py: 0,
                        minWidth: 0,
                        color: 'rgba(24, 88, 163, 0.7)',
                        '&:hover': { color: '#1858a3', background: 'rgba(24, 88, 163, 0.06)' },
                      }}
                    >
                      {bundle.flowGraph.title}
                    </Button>
                  ) : undefined}
                />
                {recipePlansCollapsed ? null : (
                  <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
                    <RecipePlanList />
                  </div>
                )}
              </article>
            ) : null}

            {/* 占位 */}
            {!hasModel && !isSolveRunning && !isSolveCancelled && !loadError ? (
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>{bundle.datasetSource.waitingTitle}</h2>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                  {bundle.datasetSource.waitingDescription}
                </p>
              </article>
            ) : null}

            {hasModel && !hasStatus && !isSolveRunning && !isSolveCancelled ? (
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>{bundle.ready.title}</h2>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                  {bundle.ready.description}
                </p>
              </article>
            ) : null}
          </Box>

          {/* ── 右栏：工作台 ── */}
          <Box
            sx={{
              minWidth: 0,
              order: { xs: 1, lg: 0 },
              // 宽屏 sticky
              position: { lg: 'sticky' },
              top: { lg: 12 },
              alignSelf: { lg: 'start' },
              maxHeight: { lg: 'calc(100vh - 24px)' },
              minHeight: { lg: 0 },
              overflowY: { lg: 'auto' },
            }}
          >
            <SolveSnapshotPanel />
          </Box>
        </Box>

        <ItemSliceOverlayHost
          locale={locale}
          atlasIds={iconAtlasIds}
          itemSlicesById={model?.itemSlicesById ?? {}}
          allowedRecipesByItem={allowedRecipesByItem}
          allowedRecipeOptionsByItem={preferredRecipeOptionsByItem}
          onMarkRaw={markItemAsRawInput}
          onUnmarkRaw={unmarkItemAsRawInput}
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
          title={bundle.flowGraph.title}
          onClose={() => setFlowGraphOpen(false)}
        />
      ) : null}
    </Box>
  );
}
