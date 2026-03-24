import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import WorkbenchApp from './shell/WorkbenchApp';
import { workbenchTheme } from './shell/workbenchTheme';

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Missing #app mount point');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider theme={workbenchTheme}>
      <CssBaseline />
      <WorkbenchApp />
    </ThemeProvider>
  </React.StrictMode>
);
