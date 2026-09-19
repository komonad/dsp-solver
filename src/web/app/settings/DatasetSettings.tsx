import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { getDatasetPresetText } from '../../../i18n';
import DatasetEditorPanel from '../../catalog/editor/DatasetEditorPanel';
import StructuredDatasetEditor from '../../catalog/editor/StructuredDatasetEditor';
import { useCatalog } from '../CatalogContext';
import { useWorkbench } from '../WorkbenchContext';
import { useSolve } from '../SolveContext';

export default function DatasetSettings() {
  const { bundle, locale } = useCatalog();
  const { model } = useSolve();
  const {
    presetId, isCustomPreset, isLoading, datasetPath, defaultConfigPath, catalogLabel,
    datasetEditorText, defaultConfigEditorText, datasetEditorError, reloadCatalog, loadCatalog,
    clearCachedWorkbenchState, setDatasetEditorText, setDefaultConfigEditorText,
    applyDatasetEditorChanges, resetDatasetEditorToLoadedSource, updateDatasetEditorTexts,
    setPresetId, setCatalogLabel, setDatasetPath, setDefaultConfigPath,
  } = useWorkbench();
  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
        <Button
          size="small"
          variant="contained"
          onClick={() => void loadCatalog(datasetPath, defaultConfigPath, catalogLabel, presetId)}
          disabled={isLoading}
          sx={{ minHeight: 36, px: 1.25 }}
        >
          {isLoading ? bundle.datasetSource.loadingButton : bundle.datasetSource.loadButton}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={reloadCatalog}
          disabled={isLoading}
          sx={{ minHeight: 36, px: 1.25 }}
        >
          {bundle.datasetSource.reloadButton}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={clearCachedWorkbenchState}
          sx={{ minHeight: 36, px: 1.25 }}
        >
          {bundle.datasetSource.clearCacheButton}
        </Button>
      </Stack>

    {isCustomPreset ? (
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          mt: 1,
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <TextField
          fullWidth
          size="small"
          label={bundle.summary.datasetPathLabel}
          value={datasetPath}
          onChange={event => {
            setPresetId('custom');
            setCatalogLabel(getDatasetPresetText('custom', locale).label);
            setDatasetPath(event.target.value);
          }}
          placeholder={bundle.datasetSource.datasetPathPlaceholder}
        />
        <TextField
          fullWidth
          size="small"
          label={bundle.summary.defaultsPathLabel}
          value={defaultConfigPath}
          onChange={event => {
            setPresetId('custom');
            setCatalogLabel(getDatasetPresetText('custom', locale).label);
            setDefaultConfigPath(event.target.value);
          }}
          placeholder={bundle.datasetSource.defaultsPathPlaceholder}
        />
      </Box>
    ) : (
      <Stack spacing={0.35} sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {bundle.summary.datasetPathLabel}: {datasetPath || bundle.common.notSet}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {bundle.summary.defaultsPathLabel}: {defaultConfigPath || bundle.common.none}
        </Typography>
      </Stack>
    )}

    <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
      {model ? (
        <>
          <Chip
            size="small"
            label={`${bundle.summary.datasetLabel} ${
              model.catalogSummary.datasetLabel ?? bundle.common.custom
            }`}
          />
          <Chip size="small" label={`${bundle.summary.itemsLabel} ${model.catalogSummary.itemCount}`} />
          <Chip size="small" label={`${bundle.summary.recipesLabel} ${model.catalogSummary.recipeCount}`} />
          <Chip size="small" label={`${bundle.summary.buildingsLabel} ${model.catalogSummary.buildingCount}`} />
        </>
      ) : (
        <Chip size="small" label={bundle.summary.loadDatasetToStart} />
      )}
    </Stack>

    <DatasetEditorPanel
      title={bundle.datasetSource.editorTitle}
      helpText={bundle.datasetSource.editorHelp}
      datasetLabel={bundle.datasetSource.editorDatasetLabel}
      defaultsLabel={bundle.datasetSource.editorDefaultsLabel}
      datasetText={datasetEditorText}
      defaultConfigText={defaultConfigEditorText}
      applyButtonLabel={bundle.datasetSource.editorApplyButton}
      resetButtonLabel={bundle.datasetSource.editorResetButton}
      errorText={datasetEditorError}
      onDatasetTextChange={setDatasetEditorText}
      onDefaultConfigTextChange={setDefaultConfigEditorText}
      onApply={applyDatasetEditorChanges}
      onReset={resetDatasetEditorToLoadedSource}
    >
      <StructuredDatasetEditor
        title={bundle.datasetSource.structuredEditorTitle}
        helpText={bundle.datasetSource.structuredEditorHelp}
        unavailableText={bundle.datasetSource.structuredEditorUnavailable}
        tabs={{
          items: bundle.datasetSource.structuredEditorTabs.items,
          recipes: bundle.datasetSource.structuredEditorTabs.recipes,
          buildingRules: bundle.datasetSource.structuredEditorTabs.buildingRules,
          defaults: bundle.datasetSource.structuredEditorTabs.defaults,
        }}
        actions={{
          add: bundle.datasetSource.structuredEditorAddButton,
          remove: bundle.datasetSource.structuredEditorRemoveButton,
        }}
        datasetText={datasetEditorText}
        defaultConfigText={defaultConfigEditorText}
        onSourceTextsChange={updateDatasetEditorTexts}
      />
    </DatasetEditorPanel>
    </Box>
  );
}
