import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, IconButton, Typography } from '@mui/material';
import type React from 'react';

export interface CollapsibleCardHeaderProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Compact summary shown next to the title (both collapsed and expanded). */
  summary?: React.ReactNode;
  /** Action buttons rendered at the right side before the toggle icon. */
  actions?: React.ReactNode;
}

export default function CollapsibleCardHeader({
  title,
  collapsed,
  onToggle,
  summary,
  actions,
}: CollapsibleCardHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 0,
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          p: 0,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
          minWidth: 0,
          flexShrink: 1,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Typography>
        <ExpandMoreRoundedIcon
          sx={{
            fontSize: 18,
            color: 'rgba(24, 51, 89, 0.58)',
            transition: 'transform 140ms ease',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </Box>

      {summary != null ? (
        <Box
          sx={{
            flex: '1 1 auto',
            minWidth: 0,
            fontSize: 12,
            color: 'rgba(24, 51, 89, 0.62)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summary}
        </Box>
      ) : (
        <Box sx={{ flex: '1 1 auto' }} />
      )}

      {actions != null ? (
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignItems: 'center' }}>
          {actions}
        </Box>
      ) : null}
    </Box>
  );
}
