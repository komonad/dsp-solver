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
  boxSizing: 'border-box',
  minWidth: 0,
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

export const recipePlanToggleGroupSx = {
  display: 'inline-flex',
  alignItems: 'stretch',
  flexWrap: 'nowrap',
  minWidth: 0,
  overflow: 'hidden',
  flex: '0 0 auto',
  borderRadius: '7px',
  border: '1px solid rgba(24, 51, 89, 0.14)',
  backgroundColor: 'rgba(255, 255, 255, 0.78)',
  '& .MuiToggleButtonGroup-grouped': {
    margin: 0,
    border: 0,
    borderRadius: 0,
  },
  '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
    marginLeft: 0,
    borderLeft: '1px solid rgba(24, 51, 89, 0.10)',
  },
} as const;

export const recipePlanToggleButtonSx = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.125,
  minWidth: 24,
  height: 20,
  px: 0.375,
  py: 0,
  borderRadius: 0,
  border: 0,
  backgroundColor: 'transparent',
  color: '#183359',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
  '&:hover': {
    backgroundColor: 'rgba(24, 51, 89, 0.08)',
  },
  '&.Mui-selected': {
    backgroundColor: 'rgba(24, 51, 89, 0.16)',
    color: '#102743',
  },
  '&.Mui-selected:hover': {
    backgroundColor: 'rgba(24, 51, 89, 0.2)',
  },
  '&.Mui-disabled': {
    color: 'rgba(24, 51, 89, 0.34)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
} as const;

export const recipePlanIconToggleButtonSx = {
  ...recipePlanToggleButtonSx,
  width: 22,
  minWidth: 22,
  px: 0,
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
  minWidth: 0,
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

export const snapshotRemoveButtonSx = {
  width: 20,
  height: 20,
  minWidth: 20,
  p: 0,
  flexShrink: 0,
  color: 'rgba(24, 51, 89, 0.72)',
  borderRadius: '8px',
  border: '1px solid rgba(24, 51, 89, 0.18)',
  backgroundColor: 'rgba(255, 255, 255, 0.82)',
  boxShadow: 'none',
  transition: 'color 140ms ease, border-color 140ms ease, background-color 140ms ease',
  '& .MuiSvgIcon-root': {
    fontSize: 11,
  },
  '&:hover': {
    color: '#a53b3b',
    borderColor: 'rgba(165, 59, 59, 0.28)',
    backgroundColor: 'rgba(165, 59, 59, 0.08)',
  },
  '&:focus-visible': {
    outline: '2px solid rgba(24, 88, 163, 0.28)',
    outlineOffset: 1,
  },
  '&:disabled': {
    color: 'rgba(24, 51, 89, 0.34)',
    borderColor: 'rgba(24, 51, 89, 0.10)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    boxShadow: 'none',
  },
} as const;

export const snapshotEmbeddedRemoveButtonSx = {
  width: 18,
  height: 18,
  minWidth: 18,
  p: 0,
  flexShrink: 0,
  color: 'rgba(24, 51, 89, 0.72)',
  borderRadius: '6px',
  border: '1px solid rgba(24, 51, 89, 0.16)',
  backgroundColor: 'rgba(255, 255, 255, 0.82)',
  boxShadow: 'none',
  transition: 'color 140ms ease, border-color 140ms ease, background-color 140ms ease',
  '& .MuiSvgIcon-root': {
    fontSize: 11,
  },
  '&:hover': {
    color: '#a53b3b',
    borderColor: 'rgba(165, 59, 59, 0.18)',
    backgroundColor: 'rgba(165, 59, 59, 0.08)',
  },
  '&:focus-visible': {
    outline: '2px solid rgba(24, 88, 163, 0.24)',
    outlineOffset: 1,
  },
  '&:disabled': {
    color: 'rgba(24, 51, 89, 0.34)',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    boxShadow: 'none',
  },
} as const;

export const snapshotEntryGroupSx = {
  display: 'inline-flex',
  alignItems: 'flex-start',
  gap: 0.5,
  flexWrap: 'nowrap',
  width: 'fit-content',
  maxWidth: '100%',
  minWidth: 0,
  alignSelf: 'flex-start',
  px: 0.875,
  py: 0.5,
  borderRadius: '10px',
  border: '1px solid rgba(24, 51, 89, 0.10)',
  backgroundColor: 'rgba(24, 51, 89, 0.04)',
} as const;

export const snapshotEntryCapsuleSx = {
  minWidth: 0,
  maxWidth: '100%',
  flex: '1 1 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  flexWrap: 'wrap',
} as const;

export const snapshotEntryActionSegmentSx = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

export const snapshotTargetFieldSx = {
  width: 80,
  height: 18,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'center',
  boxSizing: 'border-box',
  overflow: 'hidden',
  borderRadius: '6px',
  border: '1px solid rgba(24, 51, 89, 0.18)',
  backgroundColor: 'rgba(255, 255, 255, 0.88)',
  '&:focus-within': {
    borderColor: 'rgba(25, 118, 210, 0.55)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
} as const;

export const snapshotTargetInputSx = {
  width: '100%',
  height: '100%',
  minWidth: 0,
  display: 'block',
  px: 0.625,
  py: 0,
  m: 0,
  border: 0,
  outline: 0,
  background: 'transparent',
  color: '#183359',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 400,
  lineHeight: '16px',
  textAlign: 'center',
  boxSizing: 'border-box',
  appearance: 'textfield',
} as const;

export const snapshotTargetEntrySx = {
  ...snapshotEntryGroupSx,
  alignItems: 'center',
  gap: 0.375,
  py: 0.25,
} as const;

export const snapshotSectionToggleSx = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  p: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
} as const;

export const snapshotSectionToggleIconSx = {
  fontSize: 18,
  color: 'rgba(24, 51, 89, 0.58)',
  transition: 'transform 140ms ease',
  flexShrink: 0,
} as const;

export const snapshotSectionLabelClusterSx = {
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  flexWrap: 'wrap',
} as const;

export const snapshotSectionCountSx = {
  minWidth: 18,
  height: 18,
  px: 0.5,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  backgroundColor: 'rgba(24, 51, 89, 0.08)',
  color: 'rgba(24, 51, 89, 0.72)',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  boxSizing: 'border-box',
} as const;

export const snapshotSectionBodySx = {
  mt: 0.75,
} as const;

export const snapshotFormalTooltipSlotProps = {
  tooltip: {
    sx: {
      borderRadius: '4px',
      px: 0.875,
      py: 0.625,
      fontSize: 12,
      lineHeight: 1.45,
      maxWidth: 360,
      boxShadow: '0 6px 18px rgba(24, 51, 89, 0.16)',
    },
  },
} as const;

export const collapsibleSectionStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(24, 51, 89, 0.10)',
  paddingTop: 12,
};

export const inlineSectionLayoutSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 1,
  alignItems: 'center',
} as const;

export const inlineConstraintSectionGroupSx = {
  display: 'grid',
  gap: 1.25,
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  alignItems: 'start',
} as const;

export const inlineSectionLabelSx = {
  flexShrink: 0,
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
} as const;

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
