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
  globalBuildings: Array<[string, number | null]>; // [category, buildingId][] 按类别的全局建筑选择
  noByproducts: boolean;
  selectedRecipes: Array<[string, string]>; // [itemId, recipeId][]
  recipeProliferators: Array<[string, RecipeProliferatorConfig]>;
  recipeChoices: Array<[string, string]>; // [outputItemId, selectedRecipeId][] 用户在结果中选择的配方
  selectedBuildings: Array<[string, number]>; // [recipeId, buildingId][] 用户为特定配方选择的建筑
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
  globalBuildings: Map<string, number | null>; // 按类别的全局建筑选择 category -> buildingId, null表示使用默认
  noByproducts: boolean;
  selectedRecipes: Map<string, string>; // itemId -> recipeId (全局配方选择)
  recipeProliferators: Map<string, RecipeProliferatorConfig>; // recipeId -> config
  recipeChoices: Map<string, string>; // outputItemId -> selectedRecipeId (用户在结果中的切换选择)
  selectedBuildings: Map<string, number>; // recipeId -> buildingOriginalId (用户为特定配方选择的建筑，最高优先级)
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
  globalBuildings: new Map(), // 按类别存储全局建筑选择
  noByproducts: false,
  selectedRecipes: new Map(),
  recipeProliferators: new Map(),
  recipeChoices: new Map(),
  selectedBuildings: new Map(),
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
    globalBuildings: Array.from(state.globalBuildings.entries()),
    noByproducts: state.noByproducts,
    selectedRecipes: Array.from(state.selectedRecipes.entries()),
    recipeProliferators: Array.from(state.recipeProliferators.entries()),
    recipeChoices: Array.from(state.recipeChoices.entries()),
    selectedBuildings: Array.from(state.selectedBuildings.entries()),
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
    state.globalBuildings = new Map(saved.globalBuildings || []);
    state.noByproducts = saved.noByproducts || false;
    state.selectedRecipes = new Map(saved.selectedRecipes || []);
    state.recipeProliferators = new Map(saved.recipeProliferators || []);
    state.recipeChoices = new Map(saved.recipeChoices || []);
    state.selectedBuildings = new Map(saved.selectedBuildings || []);
    
    // 更新 UI
    if (state.globalProliferator) {
      const levelSelect = document.getElementById('proliferator-level') as HTMLSelectElement;
      const modeSelect = document.getElementById('proliferator-mode') as HTMLSelectElement;
      if (levelSelect) levelSelect.value = String(state.globalProliferator.level);
      if (modeSelect) modeSelect.value = state.globalProliferator.mode;
    }
    
    // 恢复全局建筑选择（按类别）
    document.querySelectorAll('.global-building-select').forEach((select: Element) => {
      const target = select as HTMLSelectElement;
      const category = target.dataset.category!;
      const buildingId = state.globalBuildings.get(category);
      target.value = buildingId ? String(buildingId) : '';
    });
    
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
  
  // 监听全局建筑选择变化（按类别）
  document.querySelectorAll('.global-building-select').forEach((select: Element) => {
    select.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const category = target.dataset.category!;
      const value = target.value;
      updateGlobalBuildingByCategory(category, value ? parseInt(value) : null);
    });
  });

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

// 按类别更新的全局建筑选择（覆盖性行为 - 会覆盖所有该类别配方的选择）
function updateGlobalBuildingByCategory(category: string, buildingId: number | null) {
  if (buildingId === null) {
    // 选择"- 不覆盖 -"：删除该类别的全局设置
    state.globalBuildings.delete(category);
  } else {
    // 选择特定建筑：设置为该类别全局默认值，并清除该类别所有特定配方选择
    state.globalBuildings.set(category, buildingId);
    
    // 清除该类别所有配方的特定选择（让全局设置生效）
    if (state.gameData) {
      for (const recipe of state.gameData.recipes) {
        const defaultBuilding = state.gameData.buildings.find(b => 
          b.originalId === recipe.factoryIds[0] || b.id === String(recipe.factoryIds[0])
        );
        if (defaultBuilding?.category === category) {
          state.selectedBuildings.delete(recipe.id);
        }
      }
    }
  }
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
  // 保存配置，即使是 level=0/mode=none 也保存（表示显式不使用增产剂）
  // 只有勾选"使用全局"时才会删除配置
  state.recipeProliferators.set(recipeId, { recipeId, level, mode });
  saveState();
  autoSolve();
}

// 删除配方特定配置（恢复使用全局）
function deleteRecipeProliferator(recipeId: string) {
  state.recipeProliferators.delete(recipeId);
  saveState();
  autoSolve();
}

// 更新配方选择的建筑
function updateRecipeBuilding(recipeId: string, buildingId: number) {
  state.selectedBuildings.set(recipeId, buildingId);
  saveState();
  autoSolve();
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
    recipeProliferators: state.recipeProliferators,
  };
  
  const result = solveMultiDemand(state.demands, state.gameData, options);
  state.lastResult = result;
  
  renderResults(result);
  renderConfigPanel(result);
}

// 判断配方是否支持增产
function canUseProliferator(recipe: Recipe, building?: Building): boolean {
  // 配方必须支持增产（proliferatorLevel > 0）
  if (recipe.proliferatorLevel <= 0) return false;
  // 如果指定了建筑，建筑必须有增产剂槽位
  if (building && !building.hasProliferatorSlot) return false;
  return true;
}

// 获取配方使用的增产剂配置
// 逻辑：全局设置作为覆盖行为，但仅在配方支持增产时生效
function getRecipeProliferator(
  recipeId: string, 
  recipe?: Recipe, 
  building?: Building
): { level: 0|1|2|3; mode: 'none'|'speed'|'productivity' } {
  // 如果提供了配方信息且配方支持增产
  const supportsProlif = recipe ? canUseProliferator(recipe, building) : true;
  
  // 全局设置作为覆盖行为：如果全局设置了增产且配方支持，则使用全局
  if (state.globalProliferator.level > 0 && supportsProlif) {
    return { 
      level: state.globalProliferator.level, 
      mode: state.globalProliferator.mode 
    };
  }
  
  // 全局未设置或配方不支持增产，检查是否有特定配置
  const specific = state.recipeProliferators.get(recipeId);
  if (specific) {
    return { level: specific.level, mode: specific.mode };
  }
  
  // 默认无增产
  return { level: 0, mode: 'none' };
}

// 计算配方执行速率和建筑信息
function calculateRecipeInfo(
  recipe: Recipe, 
  equivalentBuildingCount: number, 
  proliferator: { level: number; mode: string; sprayCount?: number },
  selectedBuilding?: Building
): { 
  equivalentBuildingCount: number; 
  actualBuildingCount: number; 
  displayedBuildingCount: number;  // 向上取整后的建筑数
  building: Building | undefined; 
  speed: number; 
  actualExecutionsPerMinute: number;
  totalPower: number;  // 总功率（MW）
} {
  if (!state.gameData) return { 
    equivalentBuildingCount: 0, 
    actualBuildingCount: 0, 
    displayedBuildingCount: 0,
    building: undefined, 
    speed: 1, 
    actualExecutionsPerMinute: 0,
    totalPower: 0
  };
  
  // 优先使用用户选择的建筑，否则使用默认建筑
  let building = selectedBuilding;
  if (!building) {
    const buildingId = recipe.factoryIds[0];
    building = state.gameData.buildings.find(b => b.originalId === buildingId || b.id === String(buildingId));
  }
  
  if (!building) return { 
    equivalentBuildingCount: 0, 
    actualBuildingCount: 0, 
    displayedBuildingCount: 0,
    building: undefined, 
    speed: 1, 
    actualExecutionsPerMinute: 0,
    totalPower: 0
  };
  
  let speedMultiplier = 1;
  if (proliferator.level > 0 && proliferator.mode === 'speed') {
    const params = DEFAULT_PROLIFERATOR_PARAMS[proliferator.level as 0|1|2|3];
    speedMultiplier = 1 + params.speedBonus;
  }
  
  const executionsPerBuildingPerMinute = (60 / recipe.time) * building.speed * speedMultiplier;
  // 实际建筑数 = 等效建筑数 / 建筑速度（加速模式会在下方进一步减少）
  let actualBuildingCount = equivalentBuildingCount / building.speed;
  // 加速模式下，建筑工作更快，所以需要的建筑数更少
  if (speedMultiplier > 1) {
    actualBuildingCount = actualBuildingCount / speedMultiplier;
  }
  // 向上取整后的建筑数（用于显示和功率计算）
  const displayedBuildingCount = Math.ceil(actualBuildingCount);
  // 注意：等效执行次数不包含速度倍数，因为加速模式只减少建筑数，不改变总产出
  const actualExecutionsPerMinute = equivalentBuildingCount * (60 / recipe.time);
  
  // 计算总功率（MW）= 建筑数 × 工作功率
  const totalPower = displayedBuildingCount * (building.workPower || 0);
  
  return { 
    equivalentBuildingCount, 
    actualBuildingCount, 
    displayedBuildingCount,
    building, 
    speed: executionsPerBuildingPerMinute, 
    actualExecutionsPerMinute,
    totalPower
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

// 获取配方可用的所有建筑
function getAvailableBuildingsForRecipe(recipe: Recipe): Building[] {
  if (!state.gameData) return [];
  return state.gameData.buildings.filter(b => 
    recipe.factoryIds.includes(b.originalId) || 
    recipe.factoryIds.includes(parseInt(b.id))
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
        <span class="rate">${rate.toFixed(2)}/min ${rate >= required - 0.01 ? '✓' : ''}</span>
        <span class="rate-required">(需求: ${required}/min)</span>
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
      
      // 计算该产出的总建筑数（向上取整）和总功率
      let totalDisplayedBuildings = 0;
      let totalPower = 0;
      for (const {recipe, count} of recipeList) {
        const selectedBuildingId = state.selectedBuildings.get(recipe.id);
        const selectedBuilding = selectedBuildingId ? 
          state.gameData.buildings.find(b => b.originalId === selectedBuildingId) : undefined;
        const { displayedBuildingCount, totalPower: power } = calculateRecipeInfo(recipe, count, getRecipeProliferator(recipe.id, recipe, selectedBuilding), selectedBuilding);
        totalDisplayedBuildings += displayedBuildingCount;
        totalPower += power;
      }
      
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
      
      // 总建筑数和功率（如果标记为原矿则显示为0）
      // 收集该产出物使用的所有建筑类型
      const buildingTypes = new Map<string, { count: number; name: string }>();
      for (const { recipe, count } of recipeList) {
        // 获取该配方使用的建筑（优先级：全局类别选择 > 特定配方选择 > 默认）
        const defaultBuilding = state.gameData.buildings.find(b => 
          b.originalId === recipe.factoryIds[0] || b.id === String(recipe.factoryIds[0])
        );
        const category = defaultBuilding?.category;
        
        // 优先级：全局类别选择 > 特定配方选择 > 默认
        const globalBuildingId = category ? state.globalBuildings.get(category) : undefined;
        const specificBuildingId = state.selectedBuildings.get(recipe.id);
        const selectedBuildingId = globalBuildingId ?? specificBuildingId;
        
        const selectedBuilding = selectedBuildingId ? 
          state.gameData.buildings.find(b => b.originalId === selectedBuildingId) : undefined;
        const building = selectedBuilding || defaultBuilding;
        
        if (building) {
          const existing = buildingTypes.get(building.name);
          const { displayedBuildingCount } = calculateRecipeInfo(recipe, count, getRecipeProliferator(recipe.id, recipe, selectedBuilding), selectedBuilding);
          if (existing) {
            existing.count += displayedBuildingCount;
          } else {
            buildingTypes.set(building.name, { count: displayedBuildingCount, name: building.name });
          }
        }
      }
      
      // 构建建筑显示字符串
      let buildingDisplay = '';
      if (buildingTypes.size === 1) {
        const [name, data] = Array.from(buildingTypes)[0];
        buildingDisplay = `${data.count} 个 ${name}`;
      } else if (buildingTypes.size > 1) {
        const parts = Array.from(buildingTypes).map(([name, data]) => `${data.count} 个 ${name}`);
        buildingDisplay = parts.join(' + ');
      } else {
        buildingDisplay = `${totalDisplayedBuildings} 个 建筑`;
      }
      
      if (isRaw) {
        html += `<span class="building-count raw">外部输入</span>`;
      } else {
        html += `<span class="building-count">${buildingDisplay}</span>`;
        html += `<span class="building-power">${totalPower.toFixed(2)} MW</span>`;
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
        // 获取该配方使用的建筑（优先级：全局类别选择 > 特定配方选择 > 默认）
        const defaultBuilding = state.gameData.buildings.find(b => 
          b.originalId === recipe.factoryIds[0] || b.id === String(recipe.factoryIds[0])
        );
        const category = defaultBuilding?.category;
        
        const globalBuildingId = category ? state.globalBuildings.get(category) : undefined;
        const specificBuildingId = state.selectedBuildings.get(recipe.id);
        const finalBuildingId = globalBuildingId ?? specificBuildingId;
        
        const selectedBuilding = finalBuildingId ? 
          state.gameData.buildings.find(b => b.originalId === finalBuildingId) : undefined;
        
        const prolif = getRecipeProliferator(recipe.id, recipe, selectedBuilding);
        
        const { displayedBuildingCount, actualBuildingCount, speed, actualExecutionsPerMinute, totalPower: subPower, building: subBuilding } = calculateRecipeInfo(recipe, count, prolif, selectedBuilding);
        
        let prodMultiplier = 1;
        if (prolif.level > 0 && prolif.mode === 'productivity') {
          const params = DEFAULT_PROLIFERATOR_PARAMS[prolif.level];
          prodMultiplier = 1 + params.productivityBonus;
        }
        
        html += `<div class="recipe-subcard" data-recipe="${recipe.id}">`;
        
        // 子配方标题 - 显示实际建筑数（小数）和使用率
        const usageRate = (actualBuildingCount / displayedBuildingCount * 100).toFixed(1);
        html += `<div class="subrecipe-header">`;
        html += `<span class="subrecipe-name">${recipe.name}</span>`;
        html += `<span class="subrecipe-count">${actualBuildingCount.toFixed(2)} 个 ${subBuilding?.name || ''} (${usageRate}% 使用率, ${subPower.toFixed(2)} MW)</span>`;
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
        
        // 速度信息和建筑选择
        html += `<div class="recipe-speed">`;
        html += `<span>周期: ${recipe.time}s</span>`;
        html += `<span>单建筑: ${speed.toFixed(2)}/min</span>`;
        
        // 建筑选择下拉框
        const availableBuildings = getAvailableBuildingsForRecipe(recipe);
        if (availableBuildings.length > 1) {
          // 确定当前使用的建筑（优先级：全局类别选择 > 特定配方选择 > 默认）
          const defaultBuilding = availableBuildings[0];
          const category = defaultBuilding?.category;
          
          const globalBuildingId = category ? state.globalBuildings.get(category) : undefined;
          const specificBuildingId = state.selectedBuildings?.get(recipe.id);
          const currentBuildingId = globalBuildingId ?? specificBuildingId ?? recipe.factoryIds[0];
          
          // 检查是否被全局类别覆盖
          const isGlobalOverride = globalBuildingId !== undefined;
          const disabled = isGlobalOverride ? 'disabled' : '';
          const title = isGlobalOverride ? `${category}类全局建筑已指定: ${availableBuildings.find(b => b.originalId === globalBuildingId)?.name || ''}` : '';
          
          html += `<select class="building-select" data-recipe-id="${recipe.id}" ${disabled} title="${title}">`;
          for (const b of availableBuildings) {
            const selected = b.originalId === currentBuildingId || parseInt(b.id) === currentBuildingId ? 'selected' : '';
            html += `<option value="${b.originalId}" ${selected}>${b.name} (速度×${b.speed})</option>`;
          }
          html += `</select>`;
          
          // 如果全局类别覆盖，显示提示
          if (isGlobalOverride) {
            html += `<span class="global-override-hint" title="${title}">🌐</span>`;
          }
        }
        html += `</div>`;
        
        // 增产剂配置
        html += renderProliferatorControl(recipe.id, prolif, recipe);
        
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
  bindBuildingSelectEvents();
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
  const rawSettingsDiv = document.getElementById('summary-raw-settings');
  const jumpDiv = document.getElementById('summary-jump');
  
  if (!inputsDiv || !outputsDiv || !buildingsDiv || !jumpDiv) return;
  
  // 0. 原矿设置：显示所有用户标记的原矿
  if (rawSettingsDiv) {
    let rawSettingsHtml = '';
    if (state.treatAsRaw.size > 0) {
      rawSettingsHtml += '<div class="raw-settings-list">';
      for (const itemId of state.treatAsRaw) {
        const item = state.gameData.itemMap.get(itemId);
        rawSettingsHtml += `
          <div class="raw-setting-item">
            <span class="raw-setting-name">${item?.name || itemId}</span>
            <button class="raw-setting-remove" data-item="${itemId}" title="取消原矿标记">×</button>
          </div>
        `;
      }
      rawSettingsHtml += '</div>';
      rawSettingsHtml += '<button class="raw-settings-clear" id="clear-all-raw">清除所有原矿标记</button>';
    } else {
      rawSettingsHtml = '<div class="raw-settings-empty">暂无自定义原矿</div>';
    }
    rawSettingsDiv.innerHTML = rawSettingsHtml;
    
    // 绑定单个移除事件
    rawSettingsDiv.querySelectorAll('.raw-setting-remove').forEach((btn: Element) => {
      btn.addEventListener('click', (e: Event) => {
        const itemId = (e.currentTarget as HTMLElement).dataset.item!;
        state.treatAsRaw.delete(itemId);
        saveState();
        autoSolve();
      });
    });
    
    // 绑定清除全部事件
    const clearAllBtn = rawSettingsDiv.querySelector('#clear-all-raw');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (confirm('确定要清除所有原矿标记吗？')) {
          state.treatAsRaw.clear();
          saveState();
          autoSolve();
        }
      });
    }
  }
  
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
  
  // 3. 建筑统计（使用向上取整后的数量）和功率统计
  const buildingCounts = new Map<string, { count: number; name: string }>();
  let totalPower = 0;
  
  for (const [recipeId, count] of result.recipes) {
    const recipe = state.gameData.recipeMap.get(recipeId);
    if (!recipe) continue;
    
    // 获取该配方使用的建筑（优先级：全局类别选择 > 特定配方选择 > 默认）
    const defaultBuilding = state.gameData.buildings.find(b => 
      b.originalId === recipe.factoryIds[0] || b.id === String(recipe.factoryIds[0])
    );
    const category = defaultBuilding?.category;
    
    const globalBuildingId = category ? state.globalBuildings.get(category) : undefined;
    const specificBuildingId = state.selectedBuildings.get(recipeId);
    const finalBuildingId = globalBuildingId ?? specificBuildingId;
    
    const selectedBuilding = finalBuildingId ? 
      state.gameData.buildings.find(b => b.originalId === finalBuildingId) : undefined;
    
    const { displayedBuildingCount, totalPower: power, building } = calculateRecipeInfo(recipe, count, getRecipeProliferator(recipeId, recipe, selectedBuilding), selectedBuilding);
    
    totalPower += power;
    
    if (building) {
      const existing = buildingCounts.get(building.name);
      if (existing) {
        existing.count += displayedBuildingCount;
      } else {
        buildingCounts.set(building.name, { count: displayedBuildingCount, name: building.name });
      }
    }
  }
  
  let buildingsHtml = '';
  for (const [name, data] of buildingCounts) {
    buildingsHtml += `
      <div class="summary-item">
        <span class="name">${name}</span>
        <span class="rate">${data.count}</span>
      </div>
    `;
  }
  // 添加总功率
  buildingsHtml += `
    <div class="summary-item total-power">
      <span class="name">总功率</span>
      <span class="rate">${totalPower.toFixed(2)} MW</span>
    </div>
  `;
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
    
    const prolif = getRecipeProliferator(recipeId, recipe);
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

// 绑定建筑选择事件
function bindBuildingSelectEvents() {
  document.querySelectorAll('.building-select').forEach((sel: Element) => {
    sel.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const recipeId = target.dataset.recipeId!;
      const buildingId = parseInt(target.value);
      
      updateRecipeBuilding(recipeId, buildingId);
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

function renderProliferatorControl(
  recipeId: string, 
  current: { level: number; mode: string },
  recipe?: Recipe
): string {
  // 判断当前是否被全局覆盖
  const isGlobalOverridden = state.globalProliferator.level > 0 && 
    (recipe ? canUseProliferator(recipe) : true);
  
  // 判断是否使用了特定设置（仅在全局未覆盖时有意义）
  const hasSpecific = state.recipeProliferators.has(recipeId);
  
  let html = '<div class="proliferator-control">';
  
  // 如果被全局覆盖，显示提示
  if (isGlobalOverridden) {
    html += '<div class="prolif-global-notice">';
    html += `<span>🌐 全局覆盖: ${state.globalProliferator.mode === 'speed' ? '加速' : '增产'} Mk.${state.globalProliferator.level}</span>`;
    html += '</div>';
    html += '</div>';
    return html;
  }
  
  // 未被全局覆盖，显示自定义选项
  html += '<div class="prolif-header">';
  html += '<label class="prolif-use-custom">';
  html += `<input type="checkbox" class="prolif-custom-check" data-recipe="${recipeId}" ${hasSpecific ? 'checked' : ''}>`;
  html += '<span>自定义增产剂</span>';
  html += '</label>';
  html += '</div>';
  
  html += `<div class="prolif-custom ${hasSpecific ? '' : 'disabled'}" data-recipe="${recipeId}">`;
  
  html += '<div class="prolif-level">';
  html += '<label>等级:</label>';
  html += `<select class="prolif-level-select" data-recipe="${recipeId}" ${hasSpecific ? '' : 'disabled'}>`;
  html += `<option value="0" ${current.level === 0 ? 'selected' : ''}>无</option>`;
  html += `<option value="1" ${current.level === 1 ? 'selected' : ''}>Mk.I</option>`;
  html += `<option value="2" ${current.level === 2 ? 'selected' : ''}>Mk.II</option>`;
  html += `<option value="3" ${current.level === 3 ? 'selected' : ''}>Mk.III</option>`;
  html += '</select>';
  html += '</div>';
  
  html += '<div class="prolif-mode">';
  html += '<label>模式:</label>';
  html += `<select class="prolif-mode-select" data-recipe="${recipeId}" ${hasSpecific ? '' : 'disabled'}>`;
  html += `<option value="none" ${current.mode === 'none' ? 'selected' : ''}>无</option>`;
  html += `<option value="speed" ${current.mode === 'speed' ? 'selected' : ''}>加速</option>`;
  html += `<option value="productivity" ${current.mode === 'productivity' ? 'selected' : ''}>增产</option>`;
  html += '</select>';
  html += '</div>';
  
  html += '</div></div>';
  return html;
}

function bindProliferatorEvents() {
  // 自定义增产剂复选框事件
  document.querySelectorAll('.prolif-custom-check').forEach((cb: Element) => {
    cb.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const recipeId = target.dataset.recipe!;
      const useCustom = target.checked;
      
      const customDiv = document.querySelector(`.prolif-custom[data-recipe="${recipeId}"]`);
      const levelSelect = document.querySelector(`.prolif-level-select[data-recipe="${recipeId}"]`) as HTMLSelectElement;
      const modeSelect = document.querySelector(`.prolif-mode-select[data-recipe="${recipeId}"]`) as HTMLSelectElement;
      
      if (customDiv) customDiv.classList.toggle('disabled', !useCustom);
      if (levelSelect) levelSelect.disabled = !useCustom;
      if (modeSelect) modeSelect.disabled = !useCustom;
      
      if (useCustom) {
        // 启用自定义：保存当前选中的值
        const level = parseInt(levelSelect?.value || '1') as 0|1|2|3;
        const mode = (modeSelect?.value || 'speed') as 'none'|'speed'|'productivity';
        updateRecipeProliferator(recipeId, level, mode);
      } else {
        // 禁用自定义：删除特定配置（使用默认无增产）
        deleteRecipeProliferator(recipeId);
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
