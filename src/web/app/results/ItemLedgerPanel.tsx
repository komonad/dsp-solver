import React from 'react';
import { Button, Stack } from '@mui/material';
import ItemLedgerSection from './ItemLedgerSection';
import { useWorkbench } from '../WorkbenchContext';
import { cardStyle, resultSideColumnStyle } from '../workbenchStyles';

export default function ItemLedgerPanel() {
  const {
    bundle,
    model,
    itemLedgerScrollRef,
    itemLedgerSectionRefs,
    scrollItemLedgerToTop,
    scrollItemLedgerToBottom,
    scrollItemLedgerToSection,
  } = useWorkbench();

  if (!model) {
    return null;
  }

  return (
    <aside style={{ ...resultSideColumnStyle, gridColumn: '3', gridRow: '1 / span 2' }}>
      <article
        style={{
          ...cardStyle,
          padding: 16,
          maxHeight: '100%',
          minHeight: 0,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: 'auto auto minmax(0, 1fr)',
          gap: 12,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>{bundle.itemLedger.title}</h2>
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
          style={{
            display: 'grid',
            gap: 16,
            overflow: 'auto',
            minHeight: 0,
            paddingRight: 4,
            paddingBottom: 24,
            scrollPaddingBottom: 24,
          }}
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
      </article>
    </aside>
  );
}
