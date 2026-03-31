import React, { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  snapshotFormalTooltipSlotProps,
  snapshotSectionBodySx,
  snapshotSectionCountSx,
  snapshotSectionLabelClusterSx,
  snapshotSectionToggleIconSx,
  snapshotSectionTitleSx,
} from '../workbenchStyles';

interface CollapsibleSnapshotSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  count?: number;
  description?: React.ReactNode;
  /** Callback for the [+] add button. If omitted, the button is not rendered. */
  onAdd?: () => void;
  addLabel?: string;
  addDisabled?: boolean;
  /** When true, the [+] icon becomes a red [×] to indicate active editing. */
  adding?: boolean;
}

export default function CollapsibleSnapshotSection({
  title,
  children,
  defaultExpanded = true,
  expanded,
  onExpandedChange,
  count = 0,
  description,
  onAdd,
  addLabel,
  addDisabled,
  adding = false,
}: CollapsibleSnapshotSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const resolvedExpanded = expanded ?? internalExpanded;
  const labelContent = useMemo(
    () => (
      <Box sx={snapshotSectionLabelClusterSx}>
        <Typography color="text.secondary" sx={snapshotSectionTitleSx}>
          {title}
        </Typography>
        {count > 0 ? <Box component="span" sx={snapshotSectionCountSx}>{count}</Box> : null}
      </Box>
    ),
    [count, title]
  );

  function handleToggle() {
    const nextExpanded = !resolvedExpanded;
    if (expanded === undefined) {
      setInternalExpanded(nextExpanded);
    }
    onExpandedChange?.(nextExpanded);
  }

  function handleAdd(event: React.MouseEvent) {
    event.stopPropagation();
    // Auto-expand when adding
    if (!resolvedExpanded) {
      if (expanded === undefined) {
        setInternalExpanded(true);
      }
      onExpandedChange?.(true);
    }
    onAdd?.();
  }

  return (
    <section>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          width: '100%',
        }}
      >
        <Box
          component="button"
          type="button"
          onClick={handleToggle}
          aria-expanded={resolvedExpanded}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flex: '1 1 auto',
            minWidth: 0,
            p: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          {description ? (
            <Tooltip title={description} slotProps={snapshotFormalTooltipSlotProps}>
              {labelContent}
            </Tooltip>
          ) : (
            labelContent
          )}
          <ExpandMoreRoundedIcon
            sx={{
              ...snapshotSectionToggleIconSx,
              transform: resolvedExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          />
        </Box>
        {onAdd ? (
          <IconButton
            size="small"
            onClick={handleAdd}
            disabled={addDisabled}
            aria-label={addLabel}
            sx={{
              width: 22,
              height: 22,
              p: 0,
              flexShrink: 0,
              ml: 0.25,
              color: adding ? 'rgba(165, 59, 59, 0.78)' : 'rgba(24, 51, 89, 0.62)',
              '&:hover': {
                color: adding ? '#a53b3b' : 'rgba(24, 88, 163, 0.82)',
              },
            }}
          >
            {adding
              ? <CloseIcon sx={{ fontSize: 16 }} />
              : <AddIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        ) : null}
      </Box>
      {resolvedExpanded ? <Box sx={snapshotSectionBodySx}>{children}</Box> : null}
    </section>
  );
}
