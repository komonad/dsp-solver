import { createTheme } from '@mui/material/styles';

export const workbenchTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3564d8',
      dark: '#2449a8',
      light: '#7795e8',
    },
    secondary: {
      main: '#d07a32',
      dark: '#a65f24',
      light: '#e0a066',
    },
    background: {
      default: '#f5f7fb',
      paper: '#ffffff',
    },
    success: {
      main: '#2c7a68',
    },
    warning: {
      main: '#b7702a',
    },
    error: {
      main: '#a03535',
    },
    text: {
      primary: '#23324b',
      secondary: '#69778e',
    },
    divider: 'rgba(22, 54, 89, 0.12)',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontSize: 13,
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
      fontSize: '1.1rem',
    },
    overline: {
      fontWeight: 700,
      letterSpacing: '0.14em',
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontVariantNumeric: 'tabular-nums' },
        'button, input, select, textarea': { fontFamily: 'inherit' },
        ':focus-visible': { outline: '2px solid #3564d8', outlineOffset: 3 },
        '*': { scrollbarWidth: 'thin', scrollbarColor: '#c5cddb transparent' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #e3e8f0',
          boxShadow: '0 8px 32px rgba(35, 50, 75, 0.08)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: '#ffffff',
          fontSize: 13,
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e3e8f0',
          boxShadow: 'none',
        },
      },
    },
  },
});
