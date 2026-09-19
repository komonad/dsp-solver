import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, ButtonBase, Chip, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import { getDatasetPresetText } from '../../../i18n';
import { DATASET_PRESETS } from '../../catalog/catalogClient';
import { useCatalog } from '../CatalogContext';
import { useWorkbench } from '../WorkbenchContext';
import DatasetSettings from './DatasetSettings';

export default function GameConfigDialog({ onClose }: { onClose: () => void }) {
  const { bundle, locale } = useCatalog();
  const { presetId, loadedSource, onPresetChange, isLoading, loadError } = useWorkbench();
  const [advancedOpen, setAdvancedOpen] = useState(presetId === 'custom');

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-labelledby="game-config-title"
      slotProps={{ paper: { sx: { borderRadius: 3, maxHeight: 'calc(100dvh - 32px)', minHeight: 0, m: 2, width: 'calc(100% - 32px)' } } }}>
      <DialogTitle id="game-config-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 2, sm: 3 }, pt: 2.5 }}>
        <SportsEsportsOutlinedIcon color="primary" />
        <Box sx={{ flex: 1 }}>{bundle.workspace.gameConfig}</Box>
        <IconButton onClick={onClose} aria-label={bundle.common.closeButton}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <DialogContent data-testid="game-config-scroll" sx={{ minHeight: 0, overscrollBehavior: 'contain', px: { xs: 2, sm: 3 }, pb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {DATASET_PRESETS.map(preset => {
            const text = getDatasetPresetText(preset.id, locale);
            const selected = presetId === preset.id;
            return (
              <ButtonBase key={preset.id} disabled={isLoading} aria-pressed={selected}
                onClick={() => { onPresetChange(preset.id); if (preset.id === 'custom') setAdvancedOpen(true); }}
                sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyContent: 'stretch', alignContent: 'start', gap: 1, p: 2, textAlign: 'left', borderRadius: 2,
                  border: '1px solid', borderColor: selected ? 'primary.main' : 'divider',
                  backgroundColor: selected ? '#f1f5ff' : 'background.paper',
                  '&:hover': { borderColor: 'primary.main', backgroundColor: '#f8faff' },
                  '&.Mui-disabled': { opacity: 0.6 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography fontWeight={700} sx={{ flex: 1 }}>{text.label}</Typography>
                  {loadedSource?.presetId === preset.id ? <Chip label={bundle.workspace.currentConfig} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: 11 }} /> : null}
                  {selected ? <CheckCircleRoundedIcon color="primary" sx={{ fontSize: 18 }} /> : null}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
        {isLoading ? <Alert severity="info" sx={{ mt: 2 }}>{bundle.datasetSource.loadingButton}</Alert> : null}
        {loadError ? <Alert severity="error" sx={{ mt: 2 }}>{loadError}</Alert> : null}
        <Accordion expanded={advancedOpen} onChange={(_, expanded) => setAdvancedOpen(expanded)} disableGutters
          sx={{ mt: 3, boxShadow: 'none', borderRadius: '10px !important', '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography fontWeight={600} fontSize={13}>{bundle.workspace.advancedSettings}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ minWidth: 0 }}><DatasetSettings /></AccordionDetails>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
