import { solveMultiDemand, MultiDemandResult, MultiDemandOptions } from '../core/multiDemandSolver';
import { GameData, Item, Recipe, Building, ProliferatorEffect } from '../types';
import { loadGameDataFromURL } from '../data/loader';
import { calculateProliferatorEffect, DEFAULT_PROLIFERATOR_PARAMS } from '../core/proliferator';

// 配方特定的增产剂配置
interface RecipeProliferatorConfig {
  recipeId: string;
  level: 0 | 1 | 2 | 3;
  mode: 'none' | 'speed' | 'productivity';
}

// 保存的状态接口
interface SavedState {
  demands: Array<{ itemId: string; rate: number }>;
  treatAsRaw: string[];
  existingSupplies: Array<{ itemId: string; rate: number }>;
  globalProliferator: {
    level: 0 | 1 | 2 | 3;
    mode: 'none' | 'speed' | 'productivity';
  };
  noByproducts: boolean;
  selectedRecipes: Array<[string, string]>; // [itemId, recipeId][]
  recipeProliferators: Array<[string, RecipeProliferatorConfig]>;
  recipeChoices: Array<[string, string]>; // [outputItemId, selectedRecipeId][] 用户在结果中选择的配方
}

// 应用状态
interface AppState {
  gameData: GameData | null;
  demands: Array<{ itemId: string; rate: number }>;
  treatAsRaw: Set<string>;
  existingSupplies: Array<{ itemId: string; rate: number }>;
  globalProliferator: {
    level: 0 | 1 | 2 | 3;
    mode: 'none' | 'speed' | 'productivity';
  };
  noByproducts: boolean;
  selectedRecipes: Map<string, string>; // itemId -> recipeId (全局配方选择)
  recipeProliferators: Map<string, RecipeProliferatorConfig>; // recipeId -> config
  recipeChoices: Map<string, string>; // outputItemId -> selectedRecipeId (用户在结果中的切换选择)
  lastResult: MultiDemandResult | null;
}

const STORAGE_KEY = 'dsp-calculator-state';

// 可用数据配置
const DATA_CONFIGS = {
  'vanilla': { name: '原版 (Vanilla)', file: './Vanilla.json' },
  'refinery': { name: '炼油测试 (Refinery)', file: './Refinery.json' },
};

let currentConfig: string = 'vanilla';

const state: AppState = {
  gameData: null,
  demands: [],
  treatAsRaw: new Set(),
  existingSupplies: [],
  globalProliferator: { level: 0, mode: 'none' },
  noByproducts: false,
  selectedRecipes: new Map(),
  recipeProliferators: new Map(),
  recipeChoices: new Map(),
  lastResult: null,
};

// DOM 元素
let itemSelect: HTMLSelectElement;
let rateInput: HTMLInputElement;
let addDemandBtn: HTMLButtonElement;
let demandsList: HTMLDivElement;
let solveBtn: HTMLButtonElement;
let resultsDiv: HTMLDivElement;
let configDiv: HTMLDivElement;
let clearStateBtn: HTMLButtonElement;

// 保存状态到 localStorage
function saveState() {
  const saved: SavedState = {
    demands: state.demands,
    treatAsRaw: Array.from(state.treatAsRaw),
    existingSupplies: state.existingSupplies,
    globalProliferator: state.globalProliferator,
    noByproducts: state.noByproducts,
    selectedRecipes: Array.from(state.selectedRecipes.entries()),
    recipeProliferators: Array.from(state.recipeProliferators.entries()),
    recipeChoices: Array.from(state.recipeChoices.entries()),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

// 从 localStorage 加载状态
function loadState() {
  try {
    const savedJson = localStorage.getItem(STORAGE_KEY);
    if (!savedJson) return false;
    
    const saved: SavedState = JSON.parse(savedJson);
    
    state.demands = saved.demands || [];
    state.treatAsRaw = new Set(saved.treatAsRaw || []);
    state.existingSupplies = saved.existingSupplies || [];
    state.globalProliferator = saved.globalProliferator || { level: 0, mode: 'none' };
    state.noByproducts = saved.noByproducts || false;
    state.selectedRecipes = new Map(saved.selectedRecipes || []);
    state.recipeProliferators = new Map(saved.recipeProliferators || []);
    state.recipeChoices = new Map(saved.recipeChoices || []);
    
    // 更新 UI
    if (state.globalProliferator) {
      const levelSelect = document.getElementById('proliferator-level') as HTMLSelectElement;
      const modeSelect = document.getElementById('proliferator-mode') as HTMLSelectElement;
      if (levelSelect) levelSelect.value = String(state.globalProliferator.level);
      if (modeSelect) modeSelect.value = state.globalProliferator.mode;
    }
    
    // 恢复无副产物选项
    const noByproductsCheck = document.getElementById('no-byproducts') as HTMLInputElement;
    if (noByproductsCheck) noByproductsCheck.checked = state.noByproducts;
    
    renderDemands();
    return true;
  } catch (e) {
    console.error('加载状态失败:', e);
    return false;
  }
}

// 清除状态
function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  state.demands = [];
  state.treatAsRaw.clear();
  state.existingSupplies = [];
  state.globalProliferator = { level: 0, mode: 'none' };
  state.noByproducts = false;
  state.selectedRecipes.clear();
  state.recipeProliferators.clear();
  state.recipeChoices.clear();
  
  // 重置 UI
  const levelSelect = document.getElementById('proliferator-level') as HTMLSelectElement;
  const modeSelect = document.getElementById('proliferator-mode') as HTMLSelectElement;
  const noByproductsCheck = document.getElementById('no-byproducts') as HTMLInputElement;
  if (levelSelect) levelSelect.value = '0';
  if (modeSelect) modeSelect.value = 'none';
  if (noByproductsCheck) noByproductsCheck.checked = false;
  
  renderDemands();
  autoSolve();
}

// 切换数据配置
async function switchConfig(configKey: string) {
  console.log('switchConfig called:', configKey);
  if (!DATA_CONFIGS[configKey as keyof typeof DATA_CONFIGS]) {
    console.error('Unknown config:', configKey);
    return;
  }
  
  currentConfig = configKey;
  const config = DATA_CONFIGS[configKey as keyof typeof DATA_CONFIGS];
  
  try {
    console.log('Loading:', config.file);
    state.gameData = await loadGameDataFromURL(config.file);
    console.log(`[${config.name}] 数据加载成功:`, state.gameData.items.length, 'items');
    
    // 清空之前的选择（需求和配置都清空，因为不同配置的物品不兼容）
    state.demands = [];
    state.treatAsRaw.clear();
    state.selectedRecipes.clear();
    state.recipeChoices.clear();
    state.recipeProliferators.clear();
    state.lastResult = null;
    
    // 更新UI
    renderDemands();
    console.log('Calling populateItemSelect...');
    populateItemSelect();
    console.log('populateItemSelect done');
    
    // 清空结果区域
    if (resultsDiv) {
      resultsDiv.innerHTML = '<div class="empty">添加需求以查看结果</div>';
    }
    if (configDiv) {
      configDiv.innerHTML = '';
    }
    
    // 更新选择器
    const configSelect = document.getElementById('config-select') as HTMLSelectElement;
    if (configSelect) configSelect.value = configKey;
    
    console.log(`已切换到 [${config.name}]，请重新添加需求`);
  } catch (e) {
    console.error(`加载 [${config.name}] 失败:`, e);
    alert(`加载配置失败: ${config.name}`);
  }
}

// 初始化
async function init() {
  // 获取DOM元素
  itemSelect = document.getElementById('item-select') as HTMLSelectElement;
  rateInput = document.getElementById('rate-input') as HTMLInputElement;
  addDemandBtn = document.getElementById('add-demand') as HTMLButtonElement;
  demandsList = document.getElementById('demands-list') as HTMLDivElement;
  solveBtn = document.getElementById('solve-btn') as HTMLButtonElement;
  resultsDiv = document.getElementById('results') as HTMLDivElement;
  configDiv = document.getElementById('config-panel') as HTMLDivElement;
  clearStateBtn = document.getElementById('clear-state') as HTMLButtonElement;

  // 绑定配置选择器事件
  const configSelect = document.getElementById('config-select') as HTMLSelectElement;
  if (configSelect) {
    configSelect.addEventListener('change', (e) => {
      switchConfig((e.target as HTMLSelectElement).value);
    });
  }

  // 加载默认配置
  await switchConfig('vanilla');

  // 绑定事件
  addDemandBtn.addEventListener('click', addDemand);
  solveBtn.addEventListener('click', solve);
  if (clearStateBtn) clearStateBtn.addEventListener('click', clearState);
  
  // 监听增产剂配置变化
  document.getElementById('proliferator-level')?.addEventListener('change', updateProliferator);
  document.getElementById('proliferator-mode')?.addEventListener('change', updateProliferator);
  document.getElementById('no-byproducts')?.addEventListener('change', updateNoByproducts);

  // 加载保存的状态
  const hasSavedState = loadState();
  
  // 显示状态恢复提示
  if (hasSavedState) {
    showStateNotice();
  }
  
  // 初始求解（如果有保存的需求）
  if (hasSavedState && state.demands.length > 0) {
    autoSolve();
  } else {
    resultsDiv.innerHTML = '<div class="empty">添加需求以查看结果</div>';
  }
}

function showStateNotice() {
  const notice = document.getElementById('state-notice');
  if (notice && state.demands.length > 0) {
    notice.innerHTML = `
      <span>✓ 已恢复上次保存的配置（${state.demands.length}个需求）</span>
    `;
    notice.style.display = 'block';
    setTimeout(() => {
      notice.style.display = 'none';
    }, 5000);
  }
}

function populateItemSelect() {
  console.log('populateItemSelect called, gameData:', state.gameData ? 'yes' : 'no');
  if (!state.gameData) {
    console.warn('No gameData, skipping populateItemSelect');
    return;
  }
  if (!itemSelect) {
    console.error('itemSelect is null!');
    return;
  }
  
  console.log('Populating with', state.gameData.items.length, 'items');
  itemSelect.innerHTML = '<option value="">选择产物...</option>';
  
  // 按类型分组
  const itemsByType = new Map<number, Item[]>();
  for (const item of state.gameData.items) {
    if (!itemsByType.has(item.type)) {
      itemsByType.set(item.type, []);
    }
    itemsByType.get(item.type)!.push(item);
  }
  
  const typeNames: Record<number, string> = {
    1: '原材料',
    2: '中间产物',
    3: '成品',
    4: '矩阵',
    5: '建筑',
  };
  
  for (const [type, items] of itemsByType) {
    const group = document.createElement('optgroup');
    group.label = typeNames[type] || `类型${type}`;
    
    // 按名称排序
    items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      group.appendChild(option);
    }
    
    itemSelect.appendChild(group);
  }
}

function addDemand() {
  const itemId = itemSelect.value;
  const rate = parseFloat(rateInput.value);
  
  if (!itemId || !rate || rate <= 0) {
    alert('请选择产物并输入有效的产量');
    return;
  }
  
  // 检查是否已存在
  const existing = state.demands.find(d => d.itemId === itemId);
  if (existing) {
    existing.rate = rate;
  } else {
    state.demands.push({ itemId, rate });
  }
  
  renderDemands();
  itemSelect.value = '';
  
  saveState();
  autoSolve();
}

function removeDemand(itemId: string) {
  state.demands = state.demands.filter(d => d.itemId !== itemId);
  renderDemands();
  saveState();
  autoSolve();
}

function renderDemands() {
  if (state.demands.length === 0) {
    demandsList.innerHTML = '<div class="empty-demand">暂无需求</div>';
    return;
  }
  
  demandsList.innerHTML = state.demands.map(d => {
    const item = state.gameData?.itemMap.get(d.itemId);
    return `
      <div class="demand-tag">
        <span>${item?.name || d.itemId}: ${d.rate}/min</span>
        <span class="remove" data-item="${d.itemId}">×</span>
      </div>
    `;
  }).join('');
  
  // 绑定删除事件
  demandsList.querySelectorAll('.remove').forEach(el => {
    el.addEventListener('click', (e) => {
      const itemId = (e.target as HTMLElement).dataset.item!;
      removeDemand(itemId);
    });
  });
}

function updateProliferator() {
  const levelSelect = document.getElementById('proliferator-level') as HTMLSelectElement;
  const modeSelect = document.getElementById('proliferator-mode') as HTMLSelectElement;
  
  state.globalProliferator = {
    level: parseInt(levelSelect.value) as 0|1|2|3,
    mode: modeSelect.value as 'none'|'speed'|'productivity',
  };
  
  saveState();
  autoSolve();
}

function updateNoByproducts() {
  const checkbox = document.getElementById('no-byproducts') as HTMLInputElement;
  state.noByproducts = checkbox.checked;
  saveState();
  autoSolve();
}

function toggleRawMaterial(itemId: string) {
  if (state.treatAsRaw.has(itemId)) {
    state.treatAsRaw.delete(itemId);
  } else {
    state.treatAsRaw.add(itemId);
  }
  saveState();
  autoSolve();
}

function selectRecipe(itemId: string, recipeId: string | null) {
  if (recipeId) {
    state.selectedRecipes.set(itemId, recipeId);
  } else {
    state.selectedRecipes.delete(itemId);
  }
  saveState();
  autoSolve();
}

function updateRecipeProliferator(recipeId: string, level: 0 | 1 | 2 | 3, mode: 'none' | 'speed' | 'productivity') {
  if (level === 0 || mode === 'none') {
    state.recipeProliferators.delete(recipeId);
  } else {
    state.recipeProliferators.set(recipeId, { recipeId, level, mode });
  }
  saveState();
  autoSolve();
}

// 切换结果中显示的配方（用于同一个产出物有多个配方的情况）
function switchRecipeChoice(outputItemId: string, newRecipeId: string) {
  if (!newRecipeId) {
    state.recipeChoices.delete(outputItemId);
  } else {
    state.recipeChoices.set(outputItemId, newRecipeId);
  }
  saveState();
  autoSolve();
}

function autoSolve() {
  if (state.demands.length === 0) {
    resultsDiv.innerHTML = '<div class="empty">添加需求以查看结果</div>';
    return;
  }
  
  solve();
}

function solve() {
  if (!state.gameData || state.demands.length === 0) return;
  
  // 合并全局配方选择和用户的结果中配方选择
  const mergedSelectedRecipes = new Map(state.selectedRecipes);
  for (const [itemId, recipeId] of state.recipeChoices) {
    mergedSelectedRecipes.set(itemId, recipeId);
  }
  
  const options: MultiDemandOptions = {
    globalProliferator: state.globalProliferator.level > 0 ? {
      level: state.globalProliferator.level,
      mode: state.globalProliferator.mode,
      sprayCount: 12,
    } : undefined,
    treatAsRaw: Array.from(state.treatAsRaw),
    existingSupplies: state.existingSupplies,
    selectedRecipes: mergedSelectedRecipes,
    noByproducts: state.noByproducts,
  };
  
  const result = solveMultiDemand(state.demands, state.gameData, options);
  state.lastResult = result;
  
  renderResults(result);
  renderConfigPanel(result);
}

// 获取配方使用的增产剂配置
function getRecipeProliferator(recipeId: string): { level: 0|1|2|3; mode: 'none'|'speed'|'productivity' } {
  const specific = state.recipeProliferators.get(recipeId);
  if (specific) {
    return { level: specific.level, mode: specific.mode };
  }
  return state.globalProliferator;
}

// 计算配方执行速率和建筑信息
function calculateRecipeInfo(
  recipe: Recipe, 
  equivalentBuildingCount: number, 
  proliferator: { level: number; mode: string; sprayCount?: number }
): { equivalentBuildingCount: number; actualBuildingCount: number; building: Building | undefined; speed: number; actualExecutionsPerMinute: number } {
  if (!state.gameData) return { equivalentBuildingCount: 0, actualBuildingCount: 0, building: undefined, speed: 1, actualExecutionsPerMinute: 0 };
  
  const buildingId = recipe.factoryIds[0];
  const building = state.gameData.buildings.find(b => b.originalId === buildingId || b.id === String(buildingId));
  
  if (!building) return { equivalentBuildingCount: 0, actualBuildingCount: 0, building: undefined, speed: 1, actualExecutionsPerMinute: 0 };
  
  let speedMultiplier = 1;
  if (proliferator.level > 0 && proliferator.mode === 'speed') {
    const params = DEFAULT_PROLIFERATOR_PARAMS[proliferator.level as 0|1|2|3];
    speedMultiplier = 1 + params.speedBonus;
  }
  
  const executionsPerBuildingPerMinute = (60 / recipe.time) * building.speed * speedMultiplier;
  const actualBuildingCount = equivalentBuildingCount / building.speed;
  const actualExecutionsPerMinute = equivalentBuildingCount * (60 / recipe.time) * speedMultiplier;
  
  return { 
    equivalentBuildingCount, 
    actualBuildingCount, 
    building, 
    speed: executionsPerBuildingPerMinute, 
    actualExecutionsPerMinute 
  };
}

// 获取产出该物品的所有可用配方（排除无中生有）
function getAlternativeRecipes(itemId: string): Recipe[] {
  if (!state.gameData) return [];
  return state.gameData.recipes.filter(r => 
    r.outputs.some(o => o.itemId === itemId) &&
    !(r.inputs.length === 0 && r.name.startsWith('[无中生有]'))
  );
}

function renderResults(result: MultiDemandResult) {
  if (!state.gameData) return;
  
  let html: string = '<div class="results-container">';
  
  html += `<div class="feasibility ${result.feasible ? 'ok' : 'fail'}">`;
  html += result.feasible ? '✓ 可行方案' : '✗ ' + (result.message || '不可行');
  html += '</div>';
  
  // 需求满足
  html += '<div class="section">';
  html += '<h3>需求满足</h3>';
  html += '<div class="demand-results">';
  for (const [itemId, rate] of result.satisfiedDemands) {
    const item = state.gameData.itemMap.get(itemId);
    const demand = state.demands.find(d => d.itemId === itemId);
    const required = demand?.rate || 0;
    const status = rate >= required - 0.01 ? 'ok' : 'fail';
    html += `
      <div class="result-row ${status}">
        <span class="item-name">${item?.name || itemId}</span>
        <span class="rate">${rate.toFixed(2)}/${required}/min</span>
      </div>
    `;
  }
  html += '</div></div>';
  
  // 配方执行 - 按产出物分组展示
  if (result.recipes.size > 0) {
    html += '<div class="section">';
    html += '<h3>生产配方</h3>';
    html += '<div class="recipe-results detailed">';
    
    // 按主要产出物分组配方
    const recipesByOutput = new Map<string, Array<{recipe: Recipe, count: number}>>();
    
    for (const [recipeId, buildingCountFromSolver] of result.recipes) {
      const recipe = state.gameData.recipeMap.get(recipeId);
      if (!recipe) continue;
      
      // 使用第一个产出物作为主产出
      const mainOutputId = recipe.outputs[0].itemId;
      if (!recipesByOutput.has(mainOutputId)) {
        recipesByOutput.set(mainOutputId, []);
      }
      recipesByOutput.get(mainOutputId)!.push({recipe, count: buildingCountFromSolver});
    }
    
    // 为每个产出物组创建卡片
    for (const [outputItemId, recipeList] of recipesByOutput) {
      const outputItem = state.gameData.itemMap.get(outputItemId);
      const alternativeRecipes = getAlternativeRecipes(outputItemId);
      const hasAlternatives = alternativeRecipes.length > 1;
      
      // 计算该产出的总建筑数
      const totalBuildings = recipeList.reduce((sum, {recipe, count}) => {
        const { actualBuildingCount } = calculateRecipeInfo(recipe, count, getRecipeProliferator(recipe.id));
        return sum + actualBuildingCount;
      }, 0);
      
      // 检查是否标记为原矿
      const isRaw = state.treatAsRaw.has(outputItemId);
      
      html += `<div class="recipe-card ${isRaw ? 'is-raw' : ''}" data-output="${outputItemId}">`;
      
      // 卡片头部：产出物名称 + 总建筑数 + 原矿标记 + 配方切换
      html += `<div class="recipe-header">`;
      html += `<div class="recipe-title">`;
      html += `<span class="recipe-product">${outputItem?.name || outputItemId}</span>`;
      
      // 标记为原矿复选框
      html += `<label class="raw-toggle-inline">`;
      html += `<input type="checkbox" class="raw-checkbox-inline" data-item="${outputItemId}" ${isRaw ? 'checked' : ''}>`;
      html += `<span>原矿</span>`;
      html += `</label>`;
      
      // 如果有其他配方可选，显示切换下拉框
      if (hasAlternatives && !isRaw) {
        html += `<div class="recipe-switch">`;
        html += `<select class="recipe-switch-select" data-output-item="${outputItemId}" title="选择配方策略">`;
        html += `<option value="">混合使用 (${recipeList.length}种配方)</option>`;
        for (const altRecipe of alternativeRecipes) {
          // 检查这个替代配方当前是否被使用
          const isUsed = recipeList.some(r => r.recipe.id === altRecipe.id);
          const isExclusive = isUsed && recipeList.length === 1;
          const label = isExclusive ? '✓ ' : '';
          html += `<option value="${altRecipe.id}" ${isExclusive ? 'selected' : ''}>${label}${altRecipe.name}</option>`;
        }
        html += `</select>`;
        html += `</div>`;
      }
      
      html += `</div>`; // end recipe-title
      
      // 总建筑数（如果标记为原矿则显示为0）
      const buildingName = recipeList[0]?.recipe ? 
        state.gameData.buildings.find(b => b.originalId === recipeList[0].recipe.factoryIds[0])?.name : 
        '建筑';
      if (isRaw) {
        html += `<span class="building-count raw">外部输入</span>`;
      } else {
        html += `<span class="building-count">${Math.ceil(totalBuildings * 100) / 100} 个 ${buildingName}</span>`;
      }
      html += `</div>`;
      
      // 如果标记为原矿，只显示简要信息，不显示子配方
      if (isRaw) {
        html += `<div class="raw-notice">该物品作为外部原矿输入</div>`;
        html += `</div>`; // end recipe-card
        continue;
      }
      
      // 为组内每个配方创建详情
      for (const {recipe, count} of recipeList) {
        const prolif = getRecipeProliferator(recipe.id);
        const { actualBuildingCount, speed, actualExecutionsPerMinute } = calculateRecipeInfo(recipe, count, prolif);
        
        let prodMultiplier = 1;
        if (prolif.level > 0 && prolif.mode === 'productivity') {
          const params = DEFAULT_PROLIFERATOR_PARAMS[prolif.level];
          prodMultiplier = 1 + params.productivityBonus;
        }
        
        html += `<div class="recipe-subcard" data-recipe="${recipe.id}">`;
        
        // 子配方标题
        html += `<div class="subrecipe-header">`;
        html += `<span class="subrecipe-name">${recipe.name}</span>`;
        html += `<span class="subrecipe-count">${Math.ceil(actualBuildingCount * 100) / 100} 个</span>`;
        html += `</div>`;
        
        // 配方详情
        html += `<div class="recipe-details">`;
        
        // 输入
        html += `<div class="recipe-io">`;
        html += `<div class="io-label">输入:</div>`;
        html += `<div class="io-items">`;
        for (const input of recipe.inputs) {
          const item = state.gameData.itemMap.get(input.itemId);
          const rate = input.count * actualExecutionsPerMinute;
          html += `<span class="io-item">
            <span class="io-count">${rate.toFixed(2)}</span>
            <span class="io-name">${item?.name || input.itemId}</span>
            <span class="io-per">(${input.count}×${actualExecutionsPerMinute.toFixed(2)}/min)</span>
          </span>`;
        }
        html += `</div></div>`;
        
        // 输出
        html += `<div class="recipe-io">`;
        html += `<div class="io-label">输出:</div>`;
        html += `<div class="io-items">`;
        for (const output of recipe.outputs) {
          const item = state.gameData.itemMap.get(output.itemId);
          let rate = output.count * actualExecutionsPerMinute;
          if (prolif.mode === 'productivity') {
            rate *= prodMultiplier;
          }
          html += `<span class="io-item ${prolif?.mode === 'productivity' ? 'productivity-boost' : ''}">
            <span class="io-count">${rate.toFixed(2)}</span>
            <span class="io-name">${item?.name || output.itemId}</span>
            <span class="io-per">(${output.count}×${actualExecutionsPerMinute.toFixed(2)}/min)</span>
            ${prolif.mode === 'productivity' ? `<span class="boost-badge">+${((prodMultiplier - 1) * 100).toFixed(0)}%</span>` : ''}
          </span>`;
        }
        html += `</div></div>`;
        
        // 速度信息
        html += `<div class="recipe-speed">`;
        html += `<span>周期: ${recipe.time}s</span>`;
        html += `<span>单建筑: ${speed.toFixed(2)}/min</span>`;
        html += `</div>`;
        
        // 增产剂配置
        html += renderProliferatorControl(recipe.id, prolif);
        
        html += `</div></div>`; // end recipe-details, recipe-subcard
      }
      
      html += `</div>`; // end recipe-card
    }
    
    html += '</div></div>';
  }
  
  // 原材料消耗
  if (result.rawMaterials.size > 0) {
    html += '<div class="section">';
    html += '<h3>原材料消耗（每分钟）</h3>';
    html += '<div class="material-results">';
    for (const [itemId, rate] of result.rawMaterials) {
      if (rate > 0.001) {
        const item = state.gameData.itemMap.get(itemId);
        const isRaw = state.treatAsRaw.has(itemId);
        html += `
          <div class="result-row ${isRaw ? 'raw' : ''}">
            <span class="item-name">${item?.name || itemId} ${isRaw ? '(原矿)' : ''}</span>
            <span class="rate">${rate.toFixed(2)}/min</span>
          </div>
        `;
      }
    }
    html += '</div></div>';
  }
  
  // 中间产物结余
  if (result.intermediateBalance.size > 0) {
    html += '<div class="section">';
    html += '<h3>中间产物结余（每分钟）</h3>';
    html += '<div class="balance-results">';
    for (const [itemId, balance] of result.intermediateBalance) {
      if (Math.abs(balance) > 0.001) {
        const item = state.gameData.itemMap.get(itemId);
        const sign = balance > 0 ? '+' : '';
        html += `
          <div class="result-row ${balance > 0 ? 'surplus' : 'deficit'}">
            <span class="item-name">${item?.name || itemId}</span>
            <span class="rate">${sign}${balance.toFixed(2)}/min</span>
          </div>
        `;
      }
    }
    html += '</div></div>';
  }
  
  html += '</div>';
  resultsDiv.innerHTML = html;
  
  bindProliferatorEvents();
  bindRecipeSwitchEvents();
  bindRawToggleEvents();
  
  // 渲染右侧总结栏
  renderSummaryPanel(result);
}

// 渲染右侧总结栏
function renderSummaryPanel(result: MultiDemandResult) {
  if (!state.gameData) return;
  
  const inputsDiv = document.getElementById('summary-inputs');
  const outputsDiv = document.getElementById('summary-outputs');
  const buildingsDiv = document.getElementById('summary-buildings');
  const jumpDiv = document.getElementById('summary-jump');
  
  if (!inputsDiv || !outputsDiv || !buildingsDiv || !jumpDiv) return;
  
  // 1. 输入：原材料（带原矿取消复选框）
  let inputsHtml = '';
  if (result.rawMaterials.size > 0) {
    for (const [itemId, rate] of result.rawMaterials) {
      if (rate > 0.001) {
        const item = state.gameData.itemMap.get(itemId);
        const isRaw = state.treatAsRaw.has(itemId);
        // 只有用户标记的原矿才显示复选框
        const showCheckbox = isRaw;
        inputsHtml += `
          <div class="summary-item ${isRaw ? 'raw' : ''}">
            <label class="summary-raw-toggle">
              ${showCheckbox ? `<input type="checkbox" class="summary-raw-check" data-item="${itemId}" checked>` : '<input type="checkbox" disabled>'}
              <span class="name">${item?.name || itemId}</span>
            </label>
            <span class="rate">${rate.toFixed(2)}</span>
          </div>
        `;
      }
    }
  }
  inputsDiv.innerHTML = inputsHtml || '<div class="summary-item"><span class="name">无</span></div>';
  
  // 绑定右侧原矿取消事件
  inputsDiv.querySelectorAll('.summary-raw-check').forEach((cb: Element) => {
    cb.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const itemId = target.dataset.item!;
      if (!target.checked) {
        // 取消原矿标记
        state.treatAsRaw.delete(itemId);
        saveState();
        autoSolve();
      }
    });
  });
  
  // 2. 输出：需求满足
  let outputsHtml = '';
  for (const [itemId, rate] of result.satisfiedDemands) {
    const item = state.gameData.itemMap.get(itemId);
    outputsHtml += `
      <div class="summary-item">
        <span class="name">${item?.name || itemId}</span>
        <span class="rate">${rate.toFixed(2)}</span>
      </div>
    `;
  }
  outputsDiv.innerHTML = outputsHtml || '<div class="summary-item"><span class="name">无</span></div>';
  
  // 3. 建筑统计
  const buildingCounts = new Map<string, { count: number; name: string }>();
  for (const [recipeId, count] of result.recipes) {
    const recipe = state.gameData.recipeMap.get(recipeId);
    if (!recipe) continue;
    
    const buildingId = recipe.factoryIds[0];
    const building = state.gameData.buildings.find(b => b.originalId === buildingId);
    if (building) {
      const { actualBuildingCount } = calculateRecipeInfo(recipe, count, getRecipeProliferator(recipeId));
      const existing = buildingCounts.get(building.name);
      if (existing) {
        existing.count += actualBuildingCount;
      } else {
        buildingCounts.set(building.name, { count: actualBuildingCount, name: building.name });
      }
    }
  }
  
  let buildingsHtml = '';
  for (const [name, data] of buildingCounts) {
    buildingsHtml += `
      <div class="summary-item">
        <span class="name">${name}</span>
        <span class="rate">${Math.ceil(data.count * 100) / 100}</span>
      </div>
    `;
  }
  buildingsDiv.innerHTML = buildingsHtml || '<div class="summary-item"><span class="name">无</span></div>';
  
  // 4. 快速跳转表
  let jumpHtml = '';
  
  // 按产物分组，计算总产速
  const productRates = new Map<string, number>();
  
  // 从需求开始
  for (const [itemId, rate] of result.satisfiedDemands) {
    productRates.set(itemId, rate);
  }
  
  // 从配方输出添加
  for (const [recipeId, count] of result.recipes) {
    const recipe = state.gameData.recipeMap.get(recipeId);
    if (!recipe) continue;
    
    const prolif = getRecipeProliferator(recipeId);
    const { actualExecutionsPerMinute } = calculateRecipeInfo(recipe, count, prolif);
    
    for (const output of recipe.outputs) {
      let rate = output.count * actualExecutionsPerMinute;
      if (prolif.mode === 'productivity') {
        const params = DEFAULT_PROLIFERATOR_PARAMS[prolif.level];
        rate *= (1 + params.productivityBonus);
      }
      
      const existing = productRates.get(output.itemId) || 0;
      productRates.set(output.itemId, existing + rate);
    }
  }
  
  // 排序并生成跳转链接
  const sortedProducts = Array.from(productRates.entries())
    .sort((a, b) => b[1] - a[1]); // 按产速降序
  
  for (const [itemId, rate] of sortedProducts) {
    const item = state.gameData.itemMap.get(itemId);
    jumpHtml += `
      <a href="#" class="jump-item" data-item="${itemId}">
        <span class="product-name">${item?.name || itemId}</span>
        <span class="product-rate">${rate.toFixed(1)}</span>
      </a>
    `;
  }
  jumpDiv.innerHTML = jumpHtml || '<div class="summary-item"><span class="name">无</span></div>';
  
  // 绑定跳转事件
  jumpDiv.querySelectorAll('.jump-item').forEach((el: Element) => {
    el.addEventListener('click', (e: Event) => {
      e.preventDefault();
      const itemId = (e.currentTarget as HTMLElement).dataset.item!;
      const card = document.querySelector(`.recipe-card[data-output="${itemId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight');
        setTimeout(() => card.classList.remove('highlight'), 2000);
      }
    });
  });
}

// 绑定配方切换事件
function bindRecipeSwitchEvents() {
  document.querySelectorAll('.recipe-switch-select').forEach((sel: Element) => {
    sel.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const outputItemId = target.dataset.outputItem!;
      const newRecipeId = target.value;
      
      if (newRecipeId === '') {
        // 选择"混合使用" - 清除该物品的配方限制，让 solver 自动决定
        state.selectedRecipes.delete(outputItemId);
        state.recipeChoices.delete(outputItemId);
      } else {
        // 选择特定配方
        switchRecipeChoice(outputItemId, newRecipeId);
      }
      saveState();
      autoSolve();
    });
  });
}

// 绑定原矿标记事件
function bindRawToggleEvents() {
  document.querySelectorAll('.raw-checkbox-inline').forEach((cb: Element) => {
    cb.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const itemId = target.dataset.item!;
      const isRaw = target.checked;
      
      if (isRaw) {
        state.treatAsRaw.add(itemId);
      } else {
        state.treatAsRaw.delete(itemId);
      }
      saveState();
      autoSolve();
    });
  });
}

function renderProliferatorControl(recipeId: string, current: { level: number; mode: string }): string {
  const useGlobal = !state.recipeProliferators.has(recipeId);
  
  let html = '<div class="proliferator-control">';
  html += '<div class="prolif-header">';
  html += '<label class="prolif-use-global">';
  html += `<input type="checkbox" class="prolif-global-check" data-recipe="${recipeId}" ${useGlobal ? 'checked' : ''}>`;
  html += '<span>使用全局增产剂设置</span>';
  html += '</label>';
  html += '</div>';
  
  html += `<div class="prolif-custom ${useGlobal ? 'disabled' : ''}" data-recipe="${recipeId}">`;
  
  html += '<div class="prolif-level">';
  html += '<label>等级:</label>';
  html += `<select class="prolif-level-select" data-recipe="${recipeId}" ${useGlobal ? 'disabled' : ''}>`;
  html += `<option value="0" ${current.level === 0 ? 'selected' : ''}>无</option>`;
  html += `<option value="1" ${current.level === 1 ? 'selected' : ''}>Mk.I</option>`;
  html += `<option value="2" ${current.level === 2 ? 'selected' : ''}>Mk.II</option>`;
  html += `<option value="3" ${current.level === 3 ? 'selected' : ''}>Mk.III</option>`;
  html += '</select>';
  html += '</div>';
  
  html += '<div class="prolif-mode">';
  html += '<label>模式:</label>';
  html += `<select class="prolif-mode-select" data-recipe="${recipeId}" ${useGlobal ? 'disabled' : ''}>`;
  html += `<option value="none" ${current.mode === 'none' ? 'selected' : ''}>无</option>`;
  html += `<option value="speed" ${current.mode === 'speed' ? 'selected' : ''}>加速</option>`;
  html += `<option value="productivity" ${current.mode === 'productivity' ? 'selected' : ''}>增产</option>`;
  html += '</select>';
  html += '</div>';
  
  html += '</div></div>';
  return html;
}

function bindProliferatorEvents() {
  document.querySelectorAll('.prolif-global-check').forEach((cb: Element) => {
    cb.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const recipeId = target.dataset.recipe!;
      const useGlobal = target.checked;
      
      const customDiv = document.querySelector(`.prolif-custom[data-recipe="${recipeId}"]`);
      const levelSelect = document.querySelector(`.prolif-level-select[data-recipe="${recipeId}"]`) as HTMLSelectElement;
      const modeSelect = document.querySelector(`.prolif-mode-select[data-recipe="${recipeId}"]`) as HTMLSelectElement;
      
      if (customDiv) customDiv.classList.toggle('disabled', useGlobal);
      if (levelSelect) levelSelect.disabled = useGlobal;
      if (modeSelect) modeSelect.disabled = useGlobal;
      
      if (useGlobal) {
        state.recipeProliferators.delete(recipeId);
        saveState();
        autoSolve();
      } else {
        updateRecipeProliferator(
          recipeId,
          parseInt(levelSelect?.value || '0') as 0|1|2|3,
          (modeSelect?.value || 'none') as 'none'|'speed'|'productivity'
        );
      }
    });
  });
  
  document.querySelectorAll('.prolif-level-select').forEach((sel: Element) => {
    sel.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const recipeId = target.dataset.recipe!;
      const level = parseInt(target.value) as 0|1|2|3;
      const modeSelect = document.querySelector(`.prolif-mode-select[data-recipe="${recipeId}"]`) as HTMLSelectElement;
      const mode = (modeSelect?.value || 'none') as 'none'|'speed'|'productivity';
      updateRecipeProliferator(recipeId, level, mode);
    });
  });
  
  document.querySelectorAll('.prolif-mode-select').forEach((sel: Element) => {
    sel.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const recipeId = target.dataset.recipe!;
      const mode = target.value as 'none'|'speed'|'productivity';
      const levelSelect = document.querySelector(`.prolif-level-select[data-recipe="${recipeId}"]`) as HTMLSelectElement;
      const level = parseInt(levelSelect?.value || '0') as 0|1|2|3;
      updateRecipeProliferator(recipeId, level, mode);
    });
  });
}

function renderConfigPanel(result: MultiDemandResult) {
  if (!state.gameData) return;
  
  // 配置面板已简化，原矿标记现在直接在配方卡片中
  // 这里可以保留用于显示其他全局配置信息
  configDiv.innerHTML = '';
  
  configDiv.querySelectorAll('.raw-checkbox').forEach((cb: Element) => {
    cb.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const itemId = target.dataset.item!;
      toggleRawMaterial(itemId);
    });
  });
  
  configDiv.querySelectorAll('.recipe-selector').forEach((sel: Element) => {
    sel.addEventListener('change', (e: Event) => {
      const select = e.target as HTMLSelectElement;
      const itemId = select.dataset.item!;
      const recipeId = select.value;
      selectRecipe(itemId, recipeId || null);
    });
  });
}

function createTestData(): GameData {
  const items: Item[] = [
    { id: 'A', name: 'A（原矿）', originalId: 1, type: 1, iconName: 'a', isRaw: true },
    { id: 'D', name: 'D（原矿）', originalId: 4, type: 1, iconName: 'd', isRaw: true },
    { id: 'B', name: 'B', originalId: 2, type: 2, iconName: 'b' },
    { id: 'C', name: 'C', originalId: 3, type: 2, iconName: 'c' },
    { id: 'E', name: 'E', originalId: 5, type: 3, iconName: 'e' },
  ];

  const recipes: Recipe[] = [
    { id: 'r1', name: 'A→B+2C', originalId: 1, inputs: [{ itemId: 'A', count: 1 }], outputs: [{ itemId: 'B', count: 1 }, { itemId: 'C', count: 2 }], time: 1, factoryIds: [1], isMultiProduct: true, proliferatorLevel: 3, iconName: 'r1', type: 1 },
    { id: 'r2', name: 'A+D→2B+C', originalId: 2, inputs: [{ itemId: 'A', count: 1 }, { itemId: 'D', count: 1 }], outputs: [{ itemId: 'B', count: 2 }, { itemId: 'C', count: 1 }], time: 1, factoryIds: [1], isMultiProduct: true, proliferatorLevel: 3, iconName: 'r2', type: 1 },
    { id: 'r3', name: '3B+2C→E', originalId: 3, inputs: [{ itemId: 'B', count: 3 }, { itemId: 'C', count: 2 }], outputs: [{ itemId: 'E', count: 1 }], time: 1, factoryIds: [1], isMultiProduct: false, proliferatorLevel: 3, iconName: 'r3', type: 1 },
  ];

  const buildings: Building[] = [
    { id: '1', originalId: 1, name: '制造台', category: 'assembler', speed: 1, workPower: 1, idlePower: 0.1, hasProliferatorSlot: true },
  ];

  const itemMap = new Map(items.map(i => [i.id, i]));
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const itemToRecipes = new Map<string, Recipe[]>();
  
  for (const recipe of recipes) {
    for (const output of recipe.outputs) {
      if (!itemToRecipes.has(output.itemId)) itemToRecipes.set(output.itemId, []);
      itemToRecipes.get(output.itemId)!.push(recipe);
    }
  }

  return { 
    version: 'test', 
    items, 
    recipes, 
    buildings, 
    proliferators: [], 
    rawItemIds: ['A', 'D'], 
    itemMap, 
    recipeMap, 
    itemToRecipes 
  };
}

document.addEventListener('DOMContentLoaded', init);
