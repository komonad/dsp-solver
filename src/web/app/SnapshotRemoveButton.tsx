import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { IconButton, Tooltip } from '@mui/material';
import {
  snapshotEmbeddedRemoveButtonSx,
  snapshotRemoveButtonSx,
} from './workbenchStyles';

interface SnapshotRemoveButtonProps {
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'standalone' | 'embedded';
}

export default function SnapshotRemoveButton({
  tooltip,
  onClick,
  disabled = false,
  variant = 'standalone',
}: SnapshotRemoveButtonProps) {
  const buttonSx = variant === 'embedded'
    ? snapshotEmbeddedRemoveButtonSx
    : snapshotRemoveButtonSx;
  return (
    <Tooltip title={tooltip}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <IconButton
          aria-label={tooltip}
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={buttonSx}
        >
          <CloseRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );
}
