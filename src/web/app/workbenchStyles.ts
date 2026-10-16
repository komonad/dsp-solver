import type React from 'react';

export const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  background: '#f5f7fb',
  color: '#183359',
  fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
};

export const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e3e8f0',
  borderRadius: 12,
  padding: 14,
  boxSizing: 'border-box',
  minWidth: 0,
  boxShadow: '0 2px 8px rgba(35, 50, 75, 0.025)',
};

export const recipePlanNumberSx = {
  fontSize: 11,
  fontWeight: 650,
  color: 'text.secondary',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  flexShrink: 0,
} as const;

export const recipePlanSplitLinksSx = {
  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5,
} as const;

export const recipePlanSplitLinkSx = {
  minWidth: 0, px: 0.5, py: 0, fontSize: 12,
} as const;

export const summarySectionStyle: React.CSSProperties = {
  background: '#f9fafc', borderRadius: 10, padding: 16,
  display: 'grid', gap: 10, alignContent: 'start', minWidth: 0,
};

export const paneSidebarSx = {
  minWidth: 0, minHeight: 0, position: { lg: 'sticky' }, top: { lg: 16 },
  maxHeight: { lg: 'var(--workbench-pane-height, calc(100dvh - 32px))' }, overflowY: { lg: 'auto' },
  overscrollBehavior: 'contain', borderRadius: 1.5,
} as const;

export const paneSeparatorSx = {
  display: { xs: 'none', lg: 'flex' }, alignItems: 'center', justifyContent: 'center',
  minWidth: 0, minHeight: 0, height: 'var(--workbench-pane-height, calc(100dvh - 32px))', position: 'sticky', top: 16,
  cursor: 'col-resize', touchAction: 'none', borderRadius: 1,
  '&::before': { content: '""', position: 'absolute', top: 0, bottom: 0, width: '1px', backgroundColor: '#e0e6ef' },
  '& svg': { zIndex: 1, backgroundColor: '#f5f7fb' },
  '&:hover, &:focus-visible': { color: 'primary.main', backgroundColor: '#e8eefb' },
} as const;

export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 34,
  borderRadius: 6,
  border: '1px solid rgba(24, 51, 89, 0.18)',
  padding: '6px 10px',
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

/**
 * Extra-compact select for use inside the snapshot panel sidebar.
 * Fixed height 30px with 12px font for consistent alignment with buttons.
 */
export const snapshotSelectFieldSx = {
  ...compactSelectFieldSx,
  '& .MuiInputBase-root': {
    minWidth: 0,
    fontSize: 12,
    height: 30,
  },
  '& .MuiInputLabel-root': {
    fontSize: 12,
    transform: 'translate(10px, 7px) scale(1)',
  },
  '& .MuiInputLabel-shrink': {
    fontSize: 12,
    transform: 'translate(14px, -8px) scale(0.85)',
  },
} as const;

/** Shared wrapper box for snapshot inline editors (the [+] add forms). */
export const snapshotInlineEditorSx = {
  display: 'grid',
  gap: 0.5,
  p: 0.75,
  mb: 0.75,
  borderRadius: '8px',
  border: '1px solid rgba(24, 88, 163, 0.18)',
  backgroundColor: 'rgba(232, 243, 255, 0.38)',
} as const;

/** Compact text field style for snapshot inline editors (non-select). */
export const snapshotInlineFieldSx = {
  ...snapshotSelectFieldSx,
} as const;

/** Compact button sizing for snapshot inline editors — matches 30px input height. */
export const snapshotInlineButtonSx = {
  height: 30,
  minHeight: 0,
  px: 1,
  py: 0,
  fontSize: 12,
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  flexShrink: 0,
} as const;

export const recipePlanToggleGroupSx = {
  display: 'inline-flex',
  alignItems: 'stretch',
  flexWrap: 'nowrap',
  minWidth: 0,
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  flex: '0 0 auto',
  borderRadius: '6px',
  border: '1px solid rgba(24, 51, 89, 0.14)',
  backgroundColor: 'rgba(255, 255, 255, 0.78)',
  scrollbarWidth: 'thin',
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
  height: 22,
  px: 0.5,
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
  width: 24,
  minWidth: 24,
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

export const resultSideColumnStyle: React.CSSProperties = {
  position: 'sticky',
  top: 24,
  alignSelf: 'start',
  // Constrain the sticky side column to a single track so the ledger card can
  // stretch to the viewport height and delegate overflow to the inner scroller.
  maxHeight: 'calc(100vh - 24px)',
  minHeight: 0,
  minWidth: 0,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)',
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
  overflow: 'hidden',
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
  width: 70,
  height: 22,
  minWidth: 0,
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'center',
  boxSizing: 'border-box',
  overflow: 'hidden',
  borderRadius: '6px',
  border: '1px solid rgba(24, 51, 89, 0.18)',
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
  '&:focus-within': {
    borderColor: 'rgba(25, 118, 210, 0.55)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
} as const;

export const snapshotTargetInputSx = {
  width: 0,
  height: '100%',
  flex: '1 1 auto',
  minWidth: 0,
  display: 'block',
  px: 0.5,
  py: 0,
  m: 0,
  border: 0,
  outline: 0,
  background: 'transparent',
  color: '#183359',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '20px',
  textAlign: 'right',
  boxSizing: 'border-box',
  appearance: 'textfield',
} as const;

export const snapshotTargetEntrySx = {
  ...snapshotEntryGroupSx,
  alignItems: 'center',
  gap: 0.375,
  py: 0.375,
  px: 0.625,
  borderRadius: '8px',
  fontSize: 12,
  lineHeight: 1.3,
} as const;

export const snapshotSummarySx = {
  fontSize: 12, lineHeight: 1.5, color: 'text.secondary', overflowWrap: 'anywhere',
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

export const snapshotSectionTitleSx = {
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: 0,
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

export const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
};

export const focusDimmedStyle: React.CSSProperties = {
  minWidth: 0,
  opacity: 0.4,
  transition: 'opacity 0.15s',
};

export const focusDividerStyle: React.CSSProperties = {
  borderTop: '2px dashed rgba(24, 51, 89, 0.15)',
  margin: '8px 0',
  position: 'relative',
};

export const focusDividerLabelStyle: React.CSSProperties = {
  position: 'absolute',
  top: -9,
  left: 8,
  background: '#fff',
  padding: '0 6px',
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(24, 51, 89, 0.65)',
};

export const focusBarStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 14,
  background: '#f8faff',
  borderRadius: 10,
  border: '1px solid #e3e9f5',
};

export const focusChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 8px 3px 5px',
  borderRadius: 999,
  background: 'rgba(24, 88, 163, 0.10)',
  fontSize: 12,
  fontWeight: 600,
  color: '#183359',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
};

export const focusChipRemoveStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 4,
  fontSize: 16,
  lineHeight: 1,
  color: 'rgba(24, 51, 89, 0.7)',
};

export const focusClearButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '2px 6px',
  fontSize: 12,
  color: 'rgba(24, 51, 89, 0.7)',
  whiteSpace: 'nowrap',
};

export const focusGraphToolbarStyle: React.CSSProperties = {
  flexShrink: 0,
  maxHeight: '35vh',
  minHeight: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  padding: 8,
};

export const viewItemSelectionStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', minWidth: 0,
};

export const viewFilterDescriptionStyle: React.CSSProperties = {
  width: '100%', fontSize: 12, color: 'rgba(24, 51, 89, 0.72)',
};

export const viewRawChipStyle: React.CSSProperties = {
  ...focusChipStyle, background: 'rgba(177, 103, 24, 0.12)', color: '#795015',
};
export const recipeOptimizerCardSx = {
  display: 'grid', gap: 1.25, minWidth: 0, p: 1.5, borderRadius: 2,
  border: '1px solid rgba(60, 110, 175, 0.2)',
  background: 'linear-gradient(135deg, rgba(235, 244, 255, 0.9), rgba(247, 250, 255, 0.8))',
};

export const recipeOptimizerMetricsSx = {
  display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1,
  '& > div': { minWidth: 0, p: 0.75, borderRadius: 1, backgroundColor: 'rgba(255, 255, 255, 0.7)' },
};
