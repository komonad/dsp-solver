import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import { useCatalog } from '../app/CatalogContext';
import { paneSeparatorSx, paneSidebarSx } from '../app/workbenchStyles';
import {
  MIN_PANE_WIDTHS, WORKBENCH_LAYOUT_STORAGE_KEY, getWorkbenchPaneHeight, parseWorkbenchPaneSizes,
  resizeWorkbenchPane, resolveWorkbenchPaneWidths,
  type WorkbenchPaneSizes, type WorkbenchPaneWidths,
} from '../shared/workbenchLayout';

function readSizes() {
  try { return parseWorkbenchPaneSizes(localStorage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY)); }
  catch { return null; }
}

function saveSizes(sizes: WorkbenchPaneSizes | null) {
  try {
    if (sizes) localStorage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, JSON.stringify(sizes));
    else localStorage.removeItem(WORKBENCH_LAYOUT_STORAGE_KEY);
  } catch { /* Layout remains usable when browser storage is unavailable. */ }
}

interface ResizableWorkbenchLayoutProps {
  left: ReactNode;
  right: ReactNode;
  children: ReactNode;
}

export default function ResizableWorkbenchLayout({ left, right, children }: ResizableWorkbenchLayoutProps) {
  const { bundle } = useCatalog();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sizes, setSizes] = useState<WorkbenchPaneSizes | null>(readSizes);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const dragRef = useRef<{ x: number; widths: WorkbenchPaneWidths; initial: WorkbenchPaneSizes | null; latest: WorkbenchPaneSizes | null } | null>(null);
  const widths = resolveWorkbenchPaneWidths(containerWidth, sizes);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateGeometry = () => {
      setContainerWidth(container.clientWidth);
      container.style.setProperty('--workbench-pane-height', `${getWorkbenchPaneHeight(window.innerHeight, container.getBoundingClientRect().top)}px`);
    };
    updateGeometry();
    const observer = new ResizeObserver(updateGeometry);
    observer.observe(container);
    window.addEventListener('resize', updateGeometry);
    window.addEventListener('scroll', updateGeometry, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateGeometry);
      window.removeEventListener('scroll', updateGeometry);
    };
  }, []);

  function reset() {
    setSizes(null);
    saveSizes(null);
  }

  function separator(side: 'left' | 'right') {
    return (
      <Box role="separator" tabIndex={0} aria-orientation="vertical"
        aria-label={side === 'left' ? bundle.workspace.resizeResults : bundle.workspace.resizeSettings}
        title={bundle.workspace.resizeHint} aria-controls={`workbench-${side}-pane`}
        aria-valuenow={Math.round(widths[side])} aria-valuemin={MIN_PANE_WIDTHS[side]}
        aria-valuemax={Math.round(widths[side] + widths.center - MIN_PANE_WIDTHS.center)}
        sx={{ ...paneSeparatorSx, order: side === 'left' ? 1 : 3, color: dragging === side ? 'primary.main' : '#bdc8da' }}
        onDoubleClick={reset}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, widths, initial: sizes, latest: sizes };
          setDragging(side);
        }}
        onPointerMove={event => {
          const drag = dragRef.current;
          if (!drag || dragging !== side) return;
          drag.latest = resizeWorkbenchPane(drag.widths, side, event.clientX - drag.x);
          setSizes(drag.latest);
        }}
        onPointerUp={event => {
          if (!dragRef.current) return;
          saveSizes(dragRef.current.latest);
          dragRef.current = null;
          setDragging(null);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => {
          if (dragRef.current) setSizes(dragRef.current.initial);
          dragRef.current = null;
          setDragging(null);
        }}
        onKeyDown={event => {
          if (event.key === 'Home') { event.preventDefault(); reset(); }
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const next = resizeWorkbenchPane(widths, side, (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 64 : 16));
          setSizes(next);
          saveSizes(next);
        }}>
        <DragIndicatorRoundedIcon sx={{ fontSize: 16 }} />
      </Box>
    );
  }

  return (
    <Box ref={containerRef} data-testid="workbench-panes" sx={{ display: 'grid', alignItems: 'start', minWidth: 0,
      gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: `${widths.left}px 12px minmax(0, 1fr) 12px ${widths.right}px` },
      rowGap: 2, userSelect: dragging ? 'none' : undefined }}>
      <Box id="workbench-left-pane" data-pane="left" sx={{ ...paneSidebarSx, order: { xs: 1, lg: 0 }, display: 'grid', gap: 1.5 }}>{left}</Box>
      {separator('left')}
      <Box data-pane="center" sx={{ minWidth: 0, order: 2 }}>{children}</Box>
      {separator('right')}
      <Box id="workbench-right-pane" data-pane="right" sx={{ ...paneSidebarSx, order: { xs: 0, lg: 4 } }}>{right}</Box>
    </Box>
  );
}
