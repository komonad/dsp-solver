import React, { useMemo, useState } from 'react';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, Tooltip, Typography } from '@mui/material';
import {
  snapshotFormalTooltipSlotProps,
  snapshotSectionBodySx,
  snapshotSectionCountSx,
  snapshotSectionLabelClusterSx,
  snapshotSectionToggleIconSx,
  snapshotSectionToggleSx,
  snapshotSectionTitleSx,
} from './workbenchStyles';

interface CollapsibleSnapshotSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  count?: number;
  description?: React.ReactNode;
}

export default function CollapsibleSnapshotSection({
  title,
  children,
  defaultExpanded = true,
  expanded,
  onExpandedChange,
  count = 0,
  description,
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

  return (
    <section>
      <Box
        component="button"
        type="button"
        onClick={() => {
          const nextExpanded = !resolvedExpanded;
          if (expanded === undefined) {
            setInternalExpanded(nextExpanded);
          }
          onExpandedChange?.(nextExpanded);
        }}
        aria-expanded={resolvedExpanded}
        sx={snapshotSectionToggleSx}
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
      {resolvedExpanded ? <Box sx={snapshotSectionBodySx}>{children}</Box> : null}
    </section>
  );
}
