import React, { useState } from 'react';
import { Button, Stack } from '@mui/material';
import ItemLedgerSection from './ItemLedgerSection';
import CollapsibleCardHeader from '../components/CollapsibleCardHeader';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import { useWorkbench } from '../WorkbenchContext';
import { cardStyle, resultSideColumnStyle } from '../workbenchStyles';

export interface ItemLedgerPanelProps {
  sticky?: boolean;
}

export default function ItemLedgerPanel({ sticky = true }: ItemLedgerPanelProps) {
  const { bundle } = useCatalog();
  const { model } = useSolve();
  const {
    itemLedgerScrollRef,
    itemLedgerSectionRefs,
    scrollItemLedgerToTop,
    scrollItemLedgerToBottom,
    scrollItemLedgerToSection,
  } = useWorkbench();
  const [collapsed, setCollapsed] = useState(true);

  if (!model) {
    return null;
  }

  const containerStyle: React.CSSProperties = sticky
    ? { ...resultSideColumnStyle, gridColumn: '3', gridRow: '1 / span 2' }
    : { minWidth: 0 };
  const contentCardStyle: React.CSSProperties = sticky
    ? {
        ...cardStyle,
        padding: 12,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: collapsed ? 'auto' : 'auto auto minmax(0, 1fr)',
        gap: 12,
      }
    : {
        ...cardStyle,
        padding: 12,
        display: 'grid',
        gridTemplateRows: collapsed ? 'auto' : 'auto auto auto',
        gap: 12,
      };
  const scrollerStyle: React.CSSProperties = sticky
    ? {
        display: 'grid',
        gap: 16,
        overflow: 'auto',
        minHeight: 0,
        paddingRight: 4,
        paddingBottom: 24,
        scrollPaddingBottom: 24,
      }
    : {
        display: 'grid',
        gap: 16,
        maxHeight: 'min(65vh, 560px)',
        overflow: 'auto',
        minHeight: 0,
        paddingRight: 4,
        paddingBottom: 16,
        scrollPaddingBottom: 16,
      };

  const sectionCount = model.itemLedgerSections.reduce(
    (sum, s) => sum + s.items.length,
    0,
  );

  return (
    <aside style={containerStyle}>
      <article style={contentCardStyle}>
        <CollapsibleCardHeader
          title={bundle.itemLedger.title}
          collapsed={collapsed}
          onToggle={() => setCollapsed(prev => !prev)}
          summary={`${sectionCount}`}
        />
        {collapsed ? null : (
          <>
            <Stack spacing={1}>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                {model.itemLedgerSections.map(section => (
                  <Button
                    key={`jump-${section.key}`}
                    onClick={() => scrollItemLedgerToSection(section.key)}
                    variant="outlined"
                    size="small"
                    color="inherit"
                  >
                    {section.title}
                  </Button>
                ))}
              </Stack>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                <Button onClick={scrollItemLedgerToTop} variant="outlined" size="small" color="inherit">
                  {bundle.itemLedger.jumpToTopButton}
                </Button>
                <Button onClick={scrollItemLedgerToBottom} variant="outlined" size="small" color="inherit">
                  {bundle.itemLedger.jumpToBottomButton}
                </Button>
              </Stack>
            </Stack>
            <div
              ref={itemLedgerScrollRef}
              style={scrollerStyle}
            >
              {model.itemLedgerSections.map(section => (
                <section
                  key={section.key}
                  ref={node => {
                    itemLedgerSectionRefs.current[section.key] = node;
                  }}
                  style={{ display: 'grid', gap: 8 }}
                >
                  <ItemLedgerSection section={section} />
                </section>
              ))}
            </div>
          </>
        )}
      </article>
    </aside>
  );
}
