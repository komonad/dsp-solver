import React from 'react';
import { Box } from '@mui/material';

// ---------------------------------------------------------------------------
// SelectOption
// ---------------------------------------------------------------------------

export interface SelectOptionProps {
  label: string;
  iconKey?: string;
  size?: number;
}

export function SelectOption({ label, iconKey, size = 18 }: SelectOptionProps) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: size <= 16 ? 13 : 14,
        verticalAlign: 'middle',
      }}
    >
      {label}
    </Box>
  );
}
