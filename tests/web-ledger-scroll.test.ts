import { computeLedgerSectionScrollTop } from '../src/web/shared/ledgerScroll';

test('computeLedgerSectionScrollTop returns a container-local scroll offset', () => {
  expect(
    computeLedgerSectionScrollTop({
      currentScrollTop: 40,
      containerTop: 120,
      sectionTop: 260,
    })
  ).toBe(180);
});

test('computeLedgerSectionScrollTop clamps negative results to zero', () => {
  expect(
    computeLedgerSectionScrollTop({
      currentScrollTop: 10,
      containerTop: 200,
      sectionTop: 120,
    })
  ).toBe(0);
});
