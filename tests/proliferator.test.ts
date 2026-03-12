/**
 * 增产剂计算测试
 */

import { 
  calculateProliferatorEffect, 
  calculateBuildingCount,
  setCustomProliferatorParams,
  resetProliferatorParams,
  getProliferatorParams
} from '../src/core/proliferator';
import { ProliferatorConfig } from '../src/types';

describe('Proliferator Calculation', () => {
  beforeEach(() => {
    resetProliferatorParams();
  });

  test('no proliferator effect', () => {
    const config: ProliferatorConfig = { level: 0, mode: 'none', sprayCount: 0 };
    const effect = calculateProliferatorEffect(config, 1, true);
    
    expect(effect.speedMultiplier).toBe(1);
    expect(effect.productivityMultiplier).toBe(1);
    expect(effect.powerMultiplier).toBe(1);
    expect(effect.extraProducts).toBe(0);
  });

  test('speed mode with level 3', () => {
    const config: ProliferatorConfig = { level: 3, mode: 'speed', sprayCount: 12 };
    const effect = calculateProliferatorEffect(config, 1, true);
    
    expect(effect.speedMultiplier).toBe(1.25);
    expect(effect.productivityMultiplier).toBe(1);
    expect(effect.powerMultiplier).toBe(1.7);
  });

  test('productivity mode with level 3', () => {
    const config: ProliferatorConfig = { level: 3, mode: 'productivity', sprayCount: 12 };
    const effect = calculateProliferatorEffect(config, 1, true);
    
    expect(effect.productivityMultiplier).toBe(1.25);
    expect(effect.extraProducts).toBe(0.25);
  });

  test('building without proliferator slot', () => {
    const config: ProliferatorConfig = { level: 3, mode: 'speed', sprayCount: 12 };
    const effect = calculateProliferatorEffect(config, 1, false);
    
    expect(effect.speedMultiplier).toBe(1);
    expect(effect.productivityMultiplier).toBe(1);
  });

  test('custom parameters', () => {
    setCustomProliferatorParams({
      0: { speedBonus: 0, productivityBonus: 0, powerBonus: 0, sprayCount: 0 },
      1: { speedBonus: 0.5, productivityBonus: 0.5, powerBonus: 0.2, sprayCount: 20 },
      2: { speedBonus: 1.0, productivityBonus: 1.0, powerBonus: 0.4, sprayCount: 20 },
      3: { speedBonus: 1.5, productivityBonus: 1.5, powerBonus: 0.6, sprayCount: 20 },
    });

    const config: ProliferatorConfig = { level: 2, mode: 'speed', sprayCount: 20 };
    const effect = calculateProliferatorEffect(config, 1, true);
    
    expect(effect.speedMultiplier).toBe(2.0);
    expect(effect.powerMultiplier).toBe(1.4);
  });

  test('building count calculation', () => {
    const config: ProliferatorConfig = { level: 3, mode: 'speed', sprayCount: 12 };
    const effect = calculateProliferatorEffect(config, 1, true);
    
    // 需要60/分钟的产出，单个建筑基础产出60/分钟
    const count = calculateBuildingCount(60, 60, effect, 1);
    
    // 1.25倍速度，所以需要 60 / (60 * 1.25) = 0.8 个建筑
    expect(count).toBeCloseTo(0.8, 2);
  });

  test('building count with doubling', () => {
    const config: ProliferatorConfig = { level: 0, mode: 'none', sprayCount: 0 };
    const effect = calculateProliferatorEffect(config, 1, true);
    
    // 2倍产出效果
    const count = calculateBuildingCount(60, 60, effect, 1, 2);
    
    // 翻倍效果，需要 60 / (60 * 2) = 0.5 个建筑
    expect(count).toBe(0.5);
  });
});
