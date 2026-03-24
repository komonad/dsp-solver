import { Box, Button, Paper, Typography } from '@mui/material';
import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { AppLocale } from '../../i18n';
import { getWorkbenchExtraBundle } from '../../i18n/workbenchExtra';
import type { PresentationItemSlice } from '../../presentation';
import type { WorkbenchRecipeOption } from '../app/workbenchHelpers';
import ItemSlicePanel from './ItemSlicePanel';
import { recordItemSlicePerf } from './state/itemSlicePerf';
import {
  closeItemSliceOverlay,
  getItemSliceOverlayState,
  openItemSliceOverlay,
  subscribeItemSliceOverlay,
} from './state/itemSliceStore';

const itemSliceOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 96,
  right: 24,
  bottom: 24,
  width: 'min(560px, calc(100vw - 32px))',
  maxWidth: 'calc(100vw - 32px)',
  zIndex: 1200,
  transition: 'opacity 120ms ease, transform 120ms ease',
};

interface ItemSliceOverlayHostProps {
  locale: AppLocale;
  atlasIds?: string[];
  itemSlicesById: Record<string, PresentationItemSlice>;
  allowedRecipesByItem: Record<string, string[]>;
  allowedRecipeOptionsByItem: Record<string, WorkbenchRecipeOption[]>;
  onMarkRaw: (itemId: string) => void;
  onUnmarkRaw: (itemId: string) => void;
  onApplyPreferredRecipes: (itemId: string, recipeIds: string[]) => { accepted: boolean; message: string };
  onClearAllowedRecipes: (itemId: string) => void;
  onLocateInLedger: (itemId: string) => void;
}

export default function ItemSliceOverlayHost(props: ItemSliceOverlayHostProps) {
  const {
    locale,
    atlasIds,
    itemSlicesById,
    allowedRecipesByItem,
    allowedRecipeOptionsByItem,
    onMarkRaw,
    onUnmarkRaw,
    onApplyPreferredRecipes,
    onClearAllowedRecipes,
    onLocateInLedger,
  } = props;
  const workbenchExtra = useMemo(() => getWorkbenchExtraBundle(locale), [locale]);
  const overlayState = useSyncExternalStore(
    subscribeItemSliceOverlay,
    getItemSliceOverlayState,
    getItemSliceOverlayState
  );
  const selectedItemSlice = overlayState.selectedItemId
    ? itemSlicesById[overlayState.selectedItemId]
    : undefined;
  const allowedRecipeOptions = selectedItemSlice
    ? allowedRecipeOptionsByItem[selectedItemSlice.itemId] ?? []
    : [];

  const pendingPerfRef = useRef<{
    phase: 'open' | 'close';
    itemId?: string;
    startedAt: number;
  } | null>(null);
  const previousOverlayStateRef = useRef(overlayState);

  useEffect(() => {
    const previousState = previousOverlayStateRef.current;
    if (
      (!previousState.isOpen &&
        overlayState.isOpen &&
        overlayState.selectedItemId !== previousState.selectedItemId) ||
      (!previousState.isOpen && overlayState.isOpen)
    ) {
      pendingPerfRef.current = {
        phase: 'open',
        itemId: overlayState.selectedItemId || undefined,
        startedAt: performance.now(),
      };
    } else if (previousState.isOpen && !overlayState.isOpen) {
      pendingPerfRef.current = {
        phase: 'close',
        itemId: previousState.selectedItemId || undefined,
        startedAt: performance.now(),
      };
    }
    previousOverlayStateRef.current = overlayState;
  }, [overlayState]);

  useEffect(() => {
    if (overlayState.isOpen && !selectedItemSlice) {
      closeItemSliceOverlay();
    }
  }, [overlayState.isOpen, selectedItemSlice]);

  useEffect(() => {
    const pending = pendingPerfRef.current;
    if (!pending) {
      return;
    }

    if (pending.phase === 'open') {
      if (!overlayState.isOpen || !selectedItemSlice) {
        return;
      }
    } else if (overlayState.isOpen) {
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        const activePending = pendingPerfRef.current;
        if (!activePending) {
          return;
        }

        recordItemSlicePerf({
          phase: activePending.phase,
          itemId: activePending.itemId,
          durationMs: performance.now() - activePending.startedAt,
          recordedAt: Date.now(),
        });
        pendingPerfRef.current = null;
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [overlayState.isOpen, selectedItemSlice]);

  if (!selectedItemSlice) {
    return null;
  }

  return (
    <Box
      role="dialog"
      aria-label={workbenchExtra.itemSlice.title}
      aria-hidden={!overlayState.isOpen}
      sx={{
        ...itemSliceOverlayStyle,
        opacity: overlayState.isOpen ? 1 : 0,
        transform: overlayState.isOpen ? 'translateX(0)' : 'translateX(18px)',
        pointerEvents: overlayState.isOpen ? 'auto' : 'none',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr)',
          backgroundColor: 'rgba(248, 251, 253, 0.95)',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 22px 64px rgba(24, 51, 89, 0.18)',
          contain: 'layout paint style',
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6">{workbenchExtra.itemSlice.title}</Typography>
          <Button variant="outlined" onClick={closeItemSliceOverlay}>
            {workbenchExtra.itemSlice.closeButton}
          </Button>
        </Box>
        <Box
          sx={{
            p: 3,
            display: 'grid',
            gap: 2,
            overflow: 'auto',
            minHeight: 0,
            overscrollBehavior: 'contain',
            contain: 'layout paint style',
          }}
        >
          <ItemSlicePanel
            locale={locale}
            atlasIds={atlasIds}
            slice={selectedItemSlice}
            preferredRecipeIds={allowedRecipesByItem[selectedItemSlice.itemId] ?? []}
            preferredRecipeOptions={allowedRecipeOptions}
            onSelectItem={openItemSliceOverlay}
            onMarkRaw={onMarkRaw}
            onUnmarkRaw={onUnmarkRaw}
            onApplyPreferredRecipes={onApplyPreferredRecipes}
            onClearPreferredRecipe={onClearAllowedRecipes}
            onLocateInLedger={onLocateInLedger}
          />
        </Box>
      </Paper>
    </Box>
  );
}


