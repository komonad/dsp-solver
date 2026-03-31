import { Box, Stack, Typography } from '@mui/material';
import { EntityIcon } from '../../shared/EntityIcon';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';
import SnapshotRemoveButton from './SnapshotRemoveButton';
import {
  snapshotEntryActionSegmentSx,
  snapshotEntryCapsuleSx,
  snapshotEntryGroupSx,
} from '../workbenchStyles';

export interface RecipePreferenceSnapshotEntry {
  recipeId: string;
  recipeName: string;
  recipeIconKey?: string;
  showIcon?: boolean;
  proliferatorPreferenceLabel: string;
  onRemove: () => void;
}

export interface RecipePreferenceSnapshotListProps {
  title: string;
  description: string;
  emptyText: string;
  clearTooltip: string;
  atlasIds?: string[];
  entries: RecipePreferenceSnapshotEntry[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onAdd?: () => void;
  addLabel?: string;
  addDisabled?: boolean;
  adding?: boolean;
  inlineEditor?: React.ReactNode;
}

export default function RecipePreferenceSnapshotList({
  title,
  description,
  emptyText,
  clearTooltip,
  atlasIds,
  entries,
  expanded,
  onExpandedChange,
  onAdd,
  addLabel,
  addDisabled,
  adding,
  inlineEditor,
}: RecipePreferenceSnapshotListProps) {
  return (
    <CollapsibleSnapshotSection
      title={title}
      count={entries.length}
      description={description}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      onAdd={onAdd}
      addLabel={addLabel}
      addDisabled={addDisabled}
      adding={adding}
    >
      {inlineEditor}
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          {entries.map(entry => (
            <Box key={entry.recipeId} sx={snapshotEntryGroupSx}>
              <Box sx={snapshotEntryCapsuleSx}>
                <Box
                  sx={{
                    minWidth: 0,
                    maxWidth: '100%',
                    flex: '1 1 auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexWrap: 'wrap',
                  }}
                >
                  {entry.showIcon === false ? null : (
                    <EntityIcon
                      label={entry.recipeName}
                      iconKey={entry.recipeIconKey}
                      atlasIds={atlasIds}
                      size={18}
                    />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {entry.recipeName}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    :
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.proliferatorPreferenceLabel}
                  </Typography>
                </Box>
              </Box>
              <Box component="span" sx={snapshotEntryActionSegmentSx}>
                <SnapshotRemoveButton
                  tooltip={clearTooltip}
                  onClick={entry.onRemove}
                  variant="embedded"
                />
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </CollapsibleSnapshotSection>
  );
}
