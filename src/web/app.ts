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
  selectedRecipes: Map<string, string>; // itemId -> recipeId
  recipeProliferators: Map<string, RecipeProliferatorConfig>; // recipeId -> config
  lastResult: MultiDemandResult | null;
}

const state: AppState = {
  gameData: null,
  demands: [],
  treatAsRaw: new Set(),
  existingSupplies: [],
  globalProliferator: { level: 0, mode: 'none' },
  selectedRecipes: new Map(),
  recipeProliferators: new Map(),
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

// 初始化
async function init() {
  // 加载游戏数据
  try {
    state.gameData = await loadGameDataFromURL('./Vanilla.json');
    console.log('游戏数据加载成功:', state.gameData.items.length, 'items');
  } catch (e) {
    console.error('加载游戏数据失败:', e);
    // 使用测试数据
    state.gameData = createTestData();
  }

  // 获取DOM元素
  itemSelect = document.getElementById('item-select') as HTMLSelectElement;
  rateInput = document.getElementById('rate-input') as HTMLInputElement;
  addDemandBtn = document.getElementById('add-demand') as HTMLButtonElement;
  demandsList = document.getElementById('demands-list') as HTMLDivElement;
  solveBtn = document.getElementById('solve-btn') as HTMLButtonElement;
  resultsDiv = document.getElementById('results') as HTMLDivElement;
  configDiv = document.getElementById('config-panel') as HTMLDivElement;

  // 填充物品选择器
  populateItemSelect();

  // 绑定事件
  addDemandBtn.addEventListener('click', addDemand);
  solveBtn.addEventListener('click', solve);
  
  // 监听增产剂配置变化
  document.getElementById('proliferator-level')?.addEventListener('change', updateProliferator);
  document.getElementById('proliferator-mode')?.addEventListener('change', updateProliferator);

  // 初始求解
  autoSolve();
}

function populateItemSelect() {
  if (!state.gameData) return;
  
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
    3: '高级产物',
    4: '建筑',
    5: '物流',
  };
  
  for (const [type, items] of itemsByType) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = typeNames[type] || `类型${type}`;
    
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      optgroup.appendChild(option);
    }
    
    itemSelect.appendChild(optgroup);
  }
}

function addDemand() {
  const itemId = itemSelect.value;
  const rate = parseFloat(rateInput.value);
  
  if (!itemId || !rate || rate <= 0) {
    alert('请选择产物并输入有效的速率');
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
  autoSolve();
}

function removeDemand(itemId: string) {
  state.demands = state.demands.filter(d => d.itemId !== itemId);
  renderDemands();
  autoSolve();
}

function renderDemands() {
  demandsList.innerHTML = '';
  
  if (state.demands.length === 0) {
    demandsList.innerHTML = '<div class="empty">暂无需求，请添加</div>';
    return;
  }
  
  for (const demand of state.demands) {
    const item = state.gameData?.itemMap.get(demand.itemId);
    const div = document.createElement('div');
    div.className = 'demand-item';
    div.innerHTML = `
      <span class="item-name">${item?.name || demand.itemId}</span>
      <span class="rate">${demand.rate}/min</span>
      <button class="remove-btn" data-item="${demand.itemId}">×</button>
    `;
    div.querySelector('.remove-btn')?.addEventListener('click', () => removeDemand(demand.itemId));
    demandsList.appendChild(div);
  }
}

function updateProliferator() {
  const levelSelect = document.getElementById('proliferator-level') as HTMLSelectElement;
  const modeSelect = document.getElementById('proliferator-mode') as HTMLSelectElement;
  
  state.globalProliferator = {
    level: parseInt(levelSelect.value) as 0 | 1 | 2 | 3,
    mode: modeSelect.value as 'none' | 'speed' | 'productivity',
  };
  
  autoSolve();
}

function toggleRawMaterial(itemId: string) {
  if (state.treatAsRaw.has(itemId)) {
    state.treatAsRaw.delete(itemId);
  } else {
    state.treatAsRaw.add(itemId);
  }
  autoSolve();
}

function selectRecipe(itemId: string, recipeId: string | null) {
  if (recipeId) {
    state.selectedRecipes.set(itemId, recipeId);
  } else {
    state.selectedRecipes.delete(itemId);
  }
  autoSolve();
}

function updateRecipeProliferator(recipeId: string, level: 0 | 1 | 2 | 3, mode: 'none' | 'speed' | 'productivity') {
  if (level === 0 || mode === 'none') {
    state.recipeProliferators.delete(recipeId);
  } else {
    state.recipeProliferators.set(recipeId, { recipeId, level, mode });
  }
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
  
  const options: MultiDemandOptions = {
    globalProliferator: state.globalProliferator.level > 0 ? {
      level: state.globalProliferator.level,
      mode: state.globalProliferator.mode,
      sprayCount: 12,
    } : undefined,
    treatAsRaw: Array.from(state.treatAsRaw),
    existingSupplies: state.existingSupplies,
    selectedRecipes: state.selectedRecipes,
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
// solver 返回的 buildingCountFromSolver 是"等效建筑数"（假设建筑速度为 1）
// 实际建筑数 = 等效建筑数 / 实际建筑速度
function calculateRecipeInfo(
  recipe: Recipe, 
  equivalentBuildingCount: number, 
  proliferator: { level: number; mode: string; sprayCount?: number }
): { equivalentBuildingCount: number; actualBuildingCount: number; building: Building | undefined; speed: number; actualExecutionsPerMinute: number } {
  if (!state.gameData) return { equivalentBuildingCount: 0, actualBuildingCount: 0, building: undefined, speed: 1, actualExecutionsPerMinute: 0 };
  
  // 获取第一个可用建筑
  const buildingId = recipe.factoryIds[0];
  const building = state.gameData.buildings.find(b => b.originalId === buildingId || b.id === String(buildingId));
  
  if (!building) return { equivalentBuildingCount: 0, actualBuildingCount: 0, building: undefined, speed: 1, actualExecutionsPerMinute: 0 };
  
  // 计算增产剂效果（加速模式）
  let speedMultiplier = 1;
  if (proliferator.level > 0 && proliferator.mode === 'speed') {
    const params = DEFAULT_PROLIFERATOR_PARAMS[proliferator.level as 0|1|2|3];
    speedMultiplier = 1 + params.speedBonus;
  }
  
  // 单个建筑每分钟执行次数（使用实际建筑速度）
  const executionsPerBuildingPerMinute = (60 / recipe.time) * building.speed * speedMultiplier;
  
  // 实际建筑数量 = 等效建筑数 / 实际建筑速度
  const actualBuildingCount = equivalentBuildingCount / building.speed;
  
  // 实际的每分钟执行次数（与 solver 的约束一致）
  const actualExecutionsPerMinute = equivalentBuildingCount * (60 / recipe.time) * speedMultiplier;
  
  return { 
    equivalentBuildingCount, 
    actualBuildingCount, 
    building, 
    speed: executionsPerBuildingPerMinute, 
    actualExecutionsPerMinute 
  };
}

function renderResults(result: MultiDemandResult) {
  if (!state.gameData) return;
  
  let html: string = '<div class="results-container">';
  
  // 可行性
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
  
  // 配方执行 - 详细展示
  if (result.recipes.size > 0) {
    html += '<div class="section">';
    html += '<h3>生产配方</h3>';
    html += '<div class="recipe-results detailed">';
    
    for (const [recipeId, buildingCountFromSolver] of result.recipes) {
      const recipe = state.gameData.recipeMap.get(recipeId);
      if (!recipe) continue;
      
      const prolif = getRecipeProliferator(recipeId);
      const { actualBuildingCount, building, speed, actualExecutionsPerMinute } = calculateRecipeInfo(recipe, buildingCountFromSolver, prolif);
      const buildingCountCeil = Math.ceil(actualBuildingCount * 100) / 100; // 保留2位小数
      
      // 获取增产剂效果
      let prodMultiplier = 1;
      if (prolif.level > 0 && prolif.mode === 'productivity') {
        const params = DEFAULT_PROLIFERATOR_PARAMS[prolif.level];
        prodMultiplier = 1 + params.productivityBonus;
      }
      
      html += `<div class="recipe-card" data-recipe="${recipeId}">`;
      
      // 配方头部
      html += `<div class="recipe-header">`;
      html += `<span class="recipe-name">${recipe.name}</span>`;
      html += `<span class="building-count">${buildingCountCeil.toFixed(2)} 个 ${building?.name || '未知建筑'}</span>`;
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
        // 增产效果
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
      html += `<span>配方周期: ${recipe.time}s</span>`;
      html += `<span>单建筑速度: ${speed.toFixed(2)}/min</span>`;
      html += `<span>总执行次数: ${actualExecutionsPerMinute.toFixed(2)}/min</span>`;
      html += `</div>`;
      
      // 增产剂配置
      html += renderProliferatorControl(recipeId, prolif);
      
      html += `</div></div>`; // end recipe-details, recipe-card
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
  
  // 现有供给贡献
  if (result.existingSupplyContribution && result.existingSupplyContribution.size > 0) {
    html += '<div class="section">';
    html += '<h3>现有供给贡献</h3>';
    html += '<div class="supply-results">';
    for (const [itemId, rate] of result.existingSupplyContribution) {
      if (!itemId.startsWith('__') && rate > 0.001) {
        const item = state.gameData.itemMap.get(itemId);
        html += `
          <div class="result-row">
            <span class="item-name">${item?.name || itemId}</span>
            <span class="rate">+${rate.toFixed(2)}/min</span>
          </div>
        `;
      }
    }
    html += '</div></div>';
  }
  
  html += '</div>';
  resultsDiv.innerHTML = html;
  
  // 绑定增产剂控制事件
  bindProliferatorEvents();
}

// 渲染增产剂控制
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
  
  // 等级选择
  html += '<div class="prolif-level">';
  html += '<label>等级:</label>';
  html += `<select class="prolif-level-select" data-recipe="${recipeId}" ${useGlobal ? 'disabled' : ''}>`;
  html += `<option value="0" ${current.level === 0 ? 'selected' : ''}>无</option>`;
  html += `<option value="1" ${current.level === 1 ? 'selected' : ''}>Mk.I</option>`;
  html += `<option value="2" ${current.level === 2 ? 'selected' : ''}>Mk.II</option>`;
  html += `<option value="3" ${current.level === 3 ? 'selected' : ''}>Mk.III</option>`;
  html += '</select>';
  html += '</div>';
  
  // 模式选择
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

// 绑定增产剂事件
function bindProliferatorEvents() {
  // 全局/自定义切换
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
        autoSolve();
      } else {
        // 使用当前选择器的值
        updateRecipeProliferator(
          recipeId,
          parseInt(levelSelect?.value || '0') as 0|1|2|3,
          (modeSelect?.value || 'none') as 'none'|'speed'|'productivity'
        );
      }
    });
  });
  
  // 等级变化
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
  
  // 模式变化
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
  
  // 收集所有涉及的物品（除了需求的物品）
  const involvedItems: Set<string> = new Set();
  for (const [recipeId] of result.recipes) {
    const recipe = state.gameData.recipeMap.get(recipeId);
    if (recipe) {
      for (const input of recipe.inputs) involvedItems.add(input.itemId);
      for (const output of recipe.outputs) involvedItems.add(output.itemId);
    }
  }
  
  // 也包括需求物品
  for (const demand of state.demands) {
    involvedItems.add(demand.itemId);
  }
  
  let html: string = '<div class="config-container">';
  html += '<h3>配置中间产物</h3>';
  html += '<div class="config-list">';
  
  for (const itemId of involvedItems) {
    const item = state.gameData.itemMap.get(itemId);
    if (!item || item.isRaw) continue;
    
    const isRaw = state.treatAsRaw.has(itemId);
    const recipes = state.gameData.recipes.filter(r => 
      r.outputs.some(o => o.itemId === itemId)
    );
    
    html += `
      <div class="config-item">
        <div class="config-header">
          <label class="raw-toggle">
            <input type="checkbox" ${isRaw ? 'checked' : ''} 
                   data-item="${itemId}" class="raw-checkbox">
            <span>标记为原矿</span>
          </label>
          <span class="item-name">${item.name}</span>
        </div>
    `;
    
    if (recipes.length > 1) {
      html += '<div class="recipe-select">';
      html += `<label>选择配方:</label>`;
      html += `<select data-item="${itemId}" class="recipe-selector">`;
      html += `<option value="">自动选择</option>`;
      for (const recipe of recipes) {
        // 过滤无中生有配方
        if (recipe.inputs.length === 0 && recipe.name.startsWith('[无中生有]')) continue;
        
        const selected = state.selectedRecipes.get(itemId) === recipe.id ? 'selected' : '';
        html += `<option value="${recipe.id}" ${selected}>${recipe.name}</option>`;
      }
      html += '</select></div>';
    }
    
    html += '</div>';
  }
  
  html += '</div></div>';
  configDiv.innerHTML = html;
  
  // 绑定事件
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

// 创建测试数据（当无法加载真实数据时）
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

// 启动应用
document.addEventListener('DOMContentLoaded', init);
