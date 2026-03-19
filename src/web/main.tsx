import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import { workbenchTheme } from './theme';

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Missing #app mount point');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider theme={workbenchTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
