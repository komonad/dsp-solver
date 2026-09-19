import { useState } from 'react';
import { Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import { getDatasetPresetText } from '../../i18n';
import { useCatalog } from '../app/CatalogContext';
import { useWorkbench } from '../app/WorkbenchContext';
import GameConfigDialog from '../app/settings/GameConfigDialog';

export default function WorkbenchHeader() {
  const { bundle, locale } = useCatalog();
  const { loadedSource, isLoading } = useWorkbench();
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <>
      <Box component="header" sx={{ backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth={false} sx={{ px: { xs: 2, md: 2.5 }, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center',
              backgroundColor: 'primary.main', color: '#fff' }}><AccountTreeRoundedIcon /></Box>
            <Box>
              <Typography component="h1" sx={{ fontSize: { xs: 17, sm: 19 }, fontWeight: 750, letterSpacing: '-0.03em' }}>{bundle.page.heading}</Typography>
            </Box>
          </Box>
          <Button variant="outlined" onClick={() => setConfigOpen(true)} aria-haspopup="dialog"
            aria-label={`${bundle.workspace.gameConfig}：${loadedSource ? getDatasetPresetText(loadedSource.presetId, locale).label : bundle.common.notSet}`}
            sx={{ color: 'text.primary', borderColor: '#dce3ef', backgroundColor: '#f8faff',
              px: 1.75, py: 1, gap: 1.5, minWidth: 240, justifyContent: 'flex-start', width: { xs: '100%', sm: 'auto' } }}>
            {isLoading ? <CircularProgress size={20} /> : <SportsEsportsOutlinedIcon sx={{ color: 'primary.main' }} />}
            <Box sx={{ textAlign: 'left', flex: 1 }}>
              <Typography component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>{bundle.workspace.gameConfig}</Typography>
              <Typography component="span" sx={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{loadedSource ? getDatasetPresetText(loadedSource.presetId, locale).label : bundle.common.notSet}</Typography>
            </Box>
            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
          </Button>
        </Container>
      </Box>
      {configOpen ? <GameConfigDialog onClose={() => setConfigOpen(false)} /> : null}
    </>
  );
}
