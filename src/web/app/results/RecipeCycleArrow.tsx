import EastRoundedIcon from '@mui/icons-material/EastRounded';
import { Box, Typography } from '@mui/material';
import { formatRecipeCycleTime } from '../workbenchHelpers';

interface RecipeCycleArrowProps {
  cycleTimeSec: number;
  locale: string;
  variant?: 'stacked' | 'inline';
}

export default function RecipeCycleArrow({
  cycleTimeSec,
  locale,
  variant = 'stacked',
}: RecipeCycleArrowProps) {
  const cycleLabel = `${formatRecipeCycleTime(cycleTimeSec, locale)}s`;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.125,
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
        color: '#183359',
      }}
    >
      <Typography
        component="span"
        variant="caption"
        sx={{
          fontWeight: 400,
          color: 'inherit',
          letterSpacing: variant === 'inline' ? 0 : '0.02em',
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {cycleLabel}
      </Typography>
      <EastRoundedIcon
        sx={{
          display: 'block',
          fontSize: variant === 'inline' ? 14 : 16,
          color: 'inherit',
        }}
      />
    </Box>
  );
}
