import React from 'react';
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { type DatasetPresetId, getDatasetPresetText } from '../../i18n';
import { DATASET_PRESETS } from '../catalog/catalogClient';
import DatasetEditorPanel from '../catalog/DatasetEditorPanel';
import StructuredDatasetEditor from '../catalog/StructuredDatasetEditor';
import { cardStyle, compactSelectFieldSx } from './workbenchStyles';
import { useWorkbench } from './WorkbenchContext';

// ---------------------------------------------------------------------------
// DatasetSourcePanel
// ---------------------------------------------------------------------------

export default function DatasetSourcePanel() {
  const {
    bundle,
    locale,
    presetId,
    isCustomPreset,
    isLoading,
    catalog,
    model,
    datasetPath,
    defaultConfigPath,
    datasetEditorText,
    defaultConfigEditorText,
    datasetEditorError,
    iconAtlasIds,
    onPresetChange,
    loadCatalog,
    clearCachedWorkbenchState,
    setDatasetEditorText,
    setDefaultConfigEditorText,
    applyDatasetEditorChanges,
    resetDatasetEditorToLoadedSource,
    updateDatasetEditorTexts,
    setPresetId,
    setCatalogLabel,
    setDatasetPath,
    setDefaultConfigPath,
    catalogLabel,
  } = useWorkbench();

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 10 }}>
      <Typography variant="h6">{bundle.datasetSource.title}</Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {bundle.summary.datasetLabel}
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            sx={compactSelectFieldSx}
            value={presetId}
            onChange={event => onPresetChange(event.target.value as DatasetPresetId)}
            inputProps={{ 'aria-label': bundle.summary.datasetLabel }}
          >
            {DATASET_PRESETS.map(preset => (
              <MenuItem key={preset.id} value={preset.id}>
                {getDatasetPresetText(preset.id, locale).label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
          <Button
            size="small"
            variant="contained"
            onClick={() => void loadCatalog(datasetPath, defaultConfigPath, catalogLabel, presetId)}
            disabled={isLoading}
            sx={{ minHeight: 40, px: 1.75 }}
          >
            {isLoading ? bundle.datasetSource.loadingButton : bundle.datasetSource.loadButton}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={clearCachedWorkbenchState}
            sx={{ minHeight: 40, px: 1.75 }}
          >
            {bundle.datasetSource.clearCacheButton}
          </Button>
        </Stack>
      </Box>

      {isCustomPreset ? (
        <Box
          sx={{
            display: 'grid',
            gap: 1,
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
        <Stack spacing={0.35}>
          <Typography variant="caption" color="text.secondary">
            {bundle.summary.datasetPathLabel}: {datasetPath || bundle.common.notSet}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {bundle.summary.defaultsPathLabel}: {defaultConfigPath || bundle.common.none}
          </Typography>
        </Stack>
      )}

      <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
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
    </article>
  );
}
