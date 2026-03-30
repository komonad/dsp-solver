import { getLocaleBundle } from '../src/i18n';

test('diagnostics audit overview summary includes solved recipe count', () => {
  const summary = getLocaleBundle().diagnostics.audit.overviewSummary('101', '122', '870', '0', '51');

  expect(summary).toContain('51');
  expect(summary).toContain('实际使用');
});

test('diagnostics audit attempt usage summary includes solved recipe and plan counts', () => {
  const summary = getLocaleBundle().diagnostics.audit.attemptUsage('12', '34');

  expect(summary).toContain('12');
  expect(summary).toContain('34');
  expect(summary).toContain('产线');
});
