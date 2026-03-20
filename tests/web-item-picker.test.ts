import { filterItemPickerOptions, type ItemPickerOption } from '../src/web/shared/itemPickerModel';

const options: ItemPickerOption[] = [
  { itemId: '1001', name: '铁矿', icon: 'iron-ore' },
  { itemId: '1101', name: '铁块', icon: 'iron-ingot' },
  { itemId: '1143', name: '增产剂', icon: 'proliferator-3' },
  { itemId: '6522', name: '富勒烯内嵌银', icon: 'fullersilver' },
];

test('filterItemPickerOptions keeps original order for empty search', () => {
  expect(filterItemPickerOptions(options, '').map(option => option.itemId)).toEqual([
    '1001',
    '1101',
    '1143',
    '6522',
  ]);
});

test('filterItemPickerOptions matches by item id and ranks exact matches first', () => {
  const result = filterItemPickerOptions(options, '1101');
  expect(result.map(option => option.itemId)).toEqual(['1101']);
});

test('filterItemPickerOptions matches by item name and supports multi-token filtering', () => {
  expect(filterItemPickerOptions(options, '富勒').map(option => option.itemId)).toEqual(['6522']);
  expect(filterItemPickerOptions(options, '65 银').map(option => option.itemId)).toEqual(['6522']);
});
