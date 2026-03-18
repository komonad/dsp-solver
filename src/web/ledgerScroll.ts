export interface LedgerSectionScrollParams {
  currentScrollTop: number;
  containerTop: number;
  sectionTop: number;
}

/**
 * Convert a section's viewport position into the scrollTop that should be
 * applied to the ledger container itself. This keeps jumps scoped to the
 * side-panel scroller instead of changing the page scroll position.
 */
export function computeLedgerSectionScrollTop(
  params: LedgerSectionScrollParams
): number {
  const nextTop =
    params.currentScrollTop + (params.sectionTop - params.containerTop);

  return nextTop > 0 ? nextTop : 0;
}
