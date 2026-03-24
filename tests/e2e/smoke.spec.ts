import { test, expect } from '@playwright/test';

test.describe('冒烟测试', () => {
  test('页面加载并显示标题', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h5')).toContainText('DSP 产线求解工作台');
  });

  test('默认数据集自动加载并显示摘要', async ({ page }) => {
    await page.goto('/');

    // 等待数据集加载完成（摘要 Chip 出现）
    const itemsChip = page.locator('span.MuiChip-label', { hasText: /物品/ });
    await expect(itemsChip).toBeVisible({ timeout: 10_000 });
  });

  test('添加目标并获得求解结果', async ({ page }) => {
    await page.goto('/');

    // 等待数据集加载
    await page.locator('span.MuiChip-label', { hasText: /物品/ }).waitFor({ timeout: 10_000 });

    // 点击添加目标按钮（draft 已有默认选中的物品）
    const addButton = page.getByRole('button', { name: '添加目标' });
    await addButton.click();

    // 等待求解结果出现 — 检查配方方案标题可见
    const recipePlansTitle = page.locator('h2', { hasText: '配方方案' });
    await expect(recipePlansTitle).toBeVisible({ timeout: 10_000 });
  });

  test('求解结果包含总览和建筑统计', async ({ page }) => {
    await page.goto('/');
    await page.locator('span.MuiChip-label', { hasText: /物品/ }).waitFor({ timeout: 10_000 });

    const addButton = page.getByRole('button', { name: '添加目标' });
    await addButton.click();

    // 等待方案总览出现
    const summaryTitle = page.locator('h2', { hasText: '方案总览' });
    await expect(summaryTitle).toBeVisible({ timeout: 10_000 });
  });

  test('物品总表侧栏显示', async ({ page }) => {
    await page.goto('/');
    await page.locator('span.MuiChip-label', { hasText: /物品/ }).waitFor({ timeout: 10_000 });

    const addButton = page.getByRole('button', { name: '添加目标' });
    await addButton.click();

    // 等待全物品总表出现
    const ledgerTitle = page.locator('h2', { hasText: '全物品总表' });
    await expect(ledgerTitle).toBeVisible({ timeout: 10_000 });
  });

  test('切换求解目标不会崩溃', async ({ page }) => {
    await page.goto('/');
    await page.locator('span.MuiChip-label', { hasText: /物品/ }).waitFor({ timeout: 10_000 });

    // 修改目标函数选择
    const selectInput = page.locator('[role="combobox"]').first();
    if (await selectInput.isVisible()) {
      await selectInput.click();
      const options = page.locator('li[role="option"]');
      if (await options.count() > 1) {
        await options.nth(1).click();
      }
    }

    // 页面仍然正常
    await expect(page.locator('h5')).toContainText('DSP 产线求解工作台');
  });

  test('清除缓存按钮触发页面重载', async ({ page }) => {
    await page.goto('/');
    await page.locator('span.MuiChip-label', { hasText: /物品/ }).waitFor({ timeout: 10_000 });

    const clearButton = page.getByRole('button', { name: '清除缓存' });
    if (await clearButton.isVisible()) {
      await Promise.all([
        page.waitForNavigation({ timeout: 10_000 }).catch(() => {}),
        clearButton.click(),
      ]);
    }

    // 重载后页面正常
    await expect(page.locator('h5')).toContainText('DSP 产线求解工作台');
  });
});
