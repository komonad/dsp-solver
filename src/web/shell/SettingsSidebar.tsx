import { useState } from 'react';
import { Box, Button } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useCatalog } from '../app/CatalogContext';
import SolveSnapshotPanel from '../app/snapshot/SolveSnapshotPanel';

export default function SettingsSidebar() {
  const { bundle } = useCatalog();
  const [expanded, setExpanded] = useState(false);
  return (
    <Box component="aside" aria-label={bundle.summary.solveSnapshotTitle} data-testid="settings-sidebar" sx={{ minWidth: 0, minHeight: 0 }}>
      <Button onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="production-settings"
        startIcon={<TuneRoundedIcon />} endIcon={<ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : undefined }} />}
        sx={{ display: { xs: 'flex', lg: 'none' }, width: '100%', height: 44, justifyContent: 'flex-start', px: 1.5, py: 0,
          border: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', mb: expanded ? 1 : 0,
          '& .MuiButton-endIcon': { ml: 'auto' } }}>
        {bundle.summary.solveSnapshotTitle}
      </Button>
      <Box id="production-settings" sx={{ display: { xs: expanded ? 'block' : 'none', lg: 'block' },
        maxHeight: { xs: 'min(70dvh, max(0px, calc(var(--workbench-pane-height, 70dvh) - 52px)))', lg: 'none' }, minHeight: 0,
        overflowY: { xs: 'auto', lg: 'visible' }, overscrollBehavior: 'contain' }}>
        <SolveSnapshotPanel />
      </Box>
    </Box>
  );
}
