import { createTheme } from '@mui/material/styles';

export const workbenchTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1c4e80',
      dark: '#143758',
      light: '#4f79a3',
    },
    secondary: {
      main: '#d07a32',
      dark: '#a65f24',
      light: '#e0a066',
    },
    background: {
      default: '#eef3f7',
      paper: 'rgba(255, 255, 255, 0.84)',
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
      primary: '#163659',
      secondary: 'rgba(22, 54, 89, 0.72)',
    },
    divider: 'rgba(22, 54, 89, 0.12)',
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Noto Sans SC", "Segoe UI", sans-serif',
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
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(22, 54, 89, 0.12)',
          boxShadow: '0 22px 64px rgba(22, 54, 89, 0.12)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: 'rgba(255,255,255,0.92)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(22, 54, 89, 0.12)',
          boxShadow: '0 22px 64px rgba(22, 54, 89, 0.12)',
        },
      },
    },
  },
});
