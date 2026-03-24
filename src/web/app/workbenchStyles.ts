import type React from 'react';

export const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  background:
    'radial-gradient(circle at top left, rgba(244, 194, 102, 0.28), transparent 35%), linear-gradient(135deg, #f5efe2 0%, #dce7ef 48%, #f7f8fb 100%)',
  color: '#183359',
  fontFamily: '"IBM Plex Sans", "Noto Sans SC", sans-serif',
};

export const shellStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: '40px 24px 64px',
  display: 'grid',
  gap: 20,
};

export const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.76)',
  border: '1px solid rgba(18, 45, 77, 0.12)',
  borderRadius: 20,
  padding: 16,
  boxShadow: '0 10px 26px rgba(24, 51, 89, 0.07)',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.18)',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.94)',
  color: '#183359',
  boxSizing: 'border-box',
};

export const compactSelectFieldSx = {
  minWidth: 0,
  '& .MuiInputBase-root': {
    minWidth: 0,
  },
  '& .MuiSelect-select': {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    pr: '32px !important',
  },
  '& .MuiSelect-select > *': {
    minWidth: 0,
    maxWidth: '100%',
  },
} as const;

export const buttonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.16)',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#183359',
  color: '#fff',
};

export const subtleButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(24, 51, 89, 0.08)',
  color: '#183359',
};

export const resultBodyGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 20,
  gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 2fr) minmax(280px, 1fr)',
  alignItems: 'start',
};

export const resultMainColumnStyle: React.CSSProperties = {
  display: 'grid',
  gap: 20,
};

export const resultSideColumnStyle: React.CSSProperties = {
  position: 'sticky',
  top: 24,
  alignSelf: 'start',
  // Keep the side column height constrained to the viewport. Without an
  // explicit height, the ledger card will expand to content height and the
  // inner ledger scroller stops working.
  height: 'calc(100vh - 24px)',
  maxHeight: 'calc(100vh - 24px)',
  minHeight: 0,
  display: 'grid',
  gap: 20,
};

export const compactLedgerButtonStyle: React.CSSProperties = {
  ...subtleButtonStyle,
  minHeight: 34,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 700,
};

export const collapsibleSectionStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(24, 51, 89, 0.10)',
  paddingTop: 12,
};

export const summaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontWeight: 700,
};

export const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
};
