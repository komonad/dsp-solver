import { Box, Container, Paper, Typography } from '@mui/material';
import ItemSliceOverlayHost from '../itemSlice/ItemSliceOverlayHost';
import { WorkbenchProvider, useWorkbench } from '../app/WorkbenchContext';
import DatasetSourcePanel from '../app/DatasetSourcePanel';
import SolveRequestPanel from '../app/request/SolveRequestPanel';
import SolveSnapshotPanel from '../app/snapshot/SolveSnapshotPanel';
import ResultsArea from '../app/results/ResultsArea';
import StrategyWarningSnackbar from '../app/StrategyWarningSnackbar';
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
    model,
    loadError,
    iconAtlasIds,
    allowedRecipesByItem,
    preferredRecipeOptionsByItem,
    markItemAsRawInput,
    unmarkItemAsRawInput,
    applyAllowedRecipesForItem,
    clearAllowedRecipesForItem,
    locateItemInLedger,
    locale,
  } = useWorkbench();

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(244, 194, 102, 0.24), transparent 35%), linear-gradient(135deg, #f5efe2 0%, #dce7ef 48%, #f7f8fb 100%)',
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1560, py: 3, display: 'grid', gap: 3 }}>
        <Box sx={{ px: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {bundle.page.heading}
          </Typography>
        </Box>
        <section style={{ display: 'grid', gap: 20 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: '24px',
              display: 'grid',
              gap: 2.5,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: { xs: '1fr' },
                alignItems: 'start',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    lg: 'minmax(260px, 0.95fr) minmax(0, 1.65fr) minmax(260px, 0.95fr)',
                  },
                  alignItems: 'start',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <DatasetSourcePanel />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <SolveRequestPanel />
                </Box>
                <Box
                  sx={{
                    minWidth: 0,
                    gridColumn: {
                      xs: '1',
                      lg: '3',
                    },
                  }}
                >
                  <SolveSnapshotPanel />
                </Box>
              </Box>
            </Box>
          </Paper>

          <div style={{ display: 'grid', gap: 20 }}>
            {loadError ? (
              <article style={{ ...cardStyle, borderColor: 'rgba(180, 41, 41, 0.2)' }}>
                <h2 style={{ marginTop: 0, color: '#8e2020' }}>{bundle.datasetSource.loadErrorTitle}</h2>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{loadError}</pre>
              </article>
            ) : null}

            {model ? (
              model.status ? (
                <ResultsArea />
              ) : (
                <article style={cardStyle}>
                  <h2 style={{ marginTop: 0 }}>{bundle.ready.title}</h2>
                  <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                    {bundle.ready.description}
                  </p>
                </article>
              )
            ) : (
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>{bundle.datasetSource.waitingTitle}</h2>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                  {bundle.datasetSource.waitingDescription}
                </p>
              </article>
            )}
          </div>
        </section>
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
        />
        <StrategyWarningSnackbar />
      </Container>
    </Box>
  );
}
