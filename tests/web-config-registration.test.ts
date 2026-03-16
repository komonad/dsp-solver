import { readFileSync } from 'fs';

test('web bundle includes test config registration', () => {
  const bundle = readFileSync('./dist-web/bundle.js', 'utf8');
  expect(bundle).toContain("'test': { name: '测试配置 (Test)', file: './TestConfig.json' }");
});
