import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { AppLocale } from '../../i18n';
import type { PresentationItemRate } from '../../presentation';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';
import RecipeCycleArrow from './RecipeCycleArrow';
import { RecipeIoSequence } from './FlowRateDisplay';
import SnapshotRemoveButton from './SnapshotRemoveButton';
import {
  snapshotEntryActionSegmentSx,
  snapshotEntryCapsuleSx,
  snapshotEntryGroupSx,
} from './workbenchStyles';

export interface RecipeConstraintSnapshotEntry {
  key: string;
  recipeName?: string;
  inputs: PresentationItemRate[];
  outputs: PresentationItemRate[];
  cycleTimeSec: number;
  highlightItemId?: string;
  onRemove: () => void;
}

export interface RecipeConstraintSnapshotListProps {
  title: string;
  emptyText: string;
  clearTooltip: string;
  noneText: string;
  locale: AppLocale;
  atlasIds?: string[];
  entries: RecipeConstraintSnapshotEntry[];
}

export default function RecipeConstraintSnapshotList({
  title,
  emptyText,
  clearTooltip,
  noneText,
  locale,
  atlasIds,
  entries,
}: RecipeConstraintSnapshotListProps) {
  return (
    <CollapsibleSnapshotSection title={title}>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          {entries.map(entry => {
            const flowContent = (
              <Box
                sx={{
                  ...snapshotEntryCapsuleSx,
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    maxWidth: '100%',
                    flex: '1 1 auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.375,
                    flexWrap: 'wrap',
                    minHeight: 0,
                  }}
                >
                  <RecipeFlowContent
                    inputs={entry.inputs}
                    outputs={entry.outputs}
                    cycleTimeSec={entry.cycleTimeSec}
                    noneText={noneText}
                    locale={locale}
                    atlasIds={atlasIds}
                    highlightItemId={entry.highlightItemId}
                  />
                </Box>
              </Box>
            );

            return (
              <Box key={entry.key} sx={snapshotEntryGroupSx}>
                {entry.recipeName ? (
                  <Tooltip title={entry.recipeName}>
                    {flowContent}
                  </Tooltip>
                ) : flowContent}
                <Box component="span" sx={snapshotEntryActionSegmentSx}>
                  <SnapshotRemoveButton
                    tooltip={clearTooltip}
                    onClick={entry.onRemove}
                    variant="embedded"
                  />
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </CollapsibleSnapshotSection>
  );
}

function RecipeFlowContent({
  inputs,
  outputs,
  cycleTimeSec,
  noneText,
  locale,
  atlasIds,
  highlightItemId,
}: {
  inputs: PresentationItemRate[];
  outputs: PresentationItemRate[];
  cycleTimeSec: number;
  noneText: string;
  locale: AppLocale;
  atlasIds?: string[];
  highlightItemId?: string;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        flexWrap: 'wrap',
        minWidth: 0,
        maxWidth: '100%',
        flex: '1 1 auto',
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          display: 'flex',
          maxWidth: '100%',
        }}
      >
        <RecipeIoSequence
          items={inputs}
          locale={locale}
          atlasIds={atlasIds}
          noneText={noneText}
        />
      </Box>
      <RecipeCycleArrow cycleTimeSec={cycleTimeSec} locale={locale} />
      <Box
        sx={{
          minWidth: 0,
          display: 'flex',
          maxWidth: '100%',
        }}
      >
        <RecipeIoSequence
          items={outputs}
          highlightItemId={highlightItemId}
          locale={locale}
          atlasIds={atlasIds}
          noneText={noneText}
        />
      </Box>
    </Box>
  );
}
