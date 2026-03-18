import {
  formatBalancePolicy,
  formatPower,
  formatPreferredProliferatorLabel,
  formatProliferatorLabel,
  formatRate,
  formatSolveObjective,
  formatSolveStatus,
  getDatasetPresetText,
} from '../src/i18n';

test('i18n formatters emit zh-CN UI labels', () => {
  expect(formatRate(60)).toBe('60.00 / 分');
  expect(formatPower(12.5)).toBe('12.50 MW');
  expect(formatSolveObjective('min_buildings')).toBe('最少建筑');
  expect(formatBalancePolicy('allow_surplus')).toBe('允许冗余产物');
  expect(formatSolveStatus('optimal')).toBe('最优');
  expect(formatProliferatorLabel('speed', 2)).toBe('加速 等级 2');
  expect(formatPreferredProliferatorLabel('productivity', undefined)).toBe('增产（自动等级）');
});

test('dataset preset text comes from the locale bundle', () => {
  expect(getDatasetPresetText('vanilla')).toEqual({
    label: '原版',
    description: '完整的原版兼容数据集，以及配套的默认配置。',
  });
  expect(getDatasetPresetText('custom').label).toBe('自定义路径');
});
