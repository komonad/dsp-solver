import React, { useState } from 'react';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, Typography } from '@mui/material';
import {
  snapshotSectionBodySx,
  snapshotSectionToggleIconSx,
  snapshotSectionToggleSx,
} from './workbenchStyles';

interface CollapsibleSnapshotSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export default function CollapsibleSnapshotSection({
  title,
  children,
  defaultExpanded = true,
}: CollapsibleSnapshotSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section>
      <Box
        component="button"
        type="button"
        onClick={() => setExpanded(current => !current)}
        aria-expanded={expanded}
        sx={snapshotSectionToggleSx}
      >
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
        <ExpandMoreRoundedIcon
          sx={{
            ...snapshotSectionToggleIconSx,
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
      </Box>
      {expanded ? <Box sx={snapshotSectionBodySx}>{children}</Box> : null}
    </section>
  );
}
