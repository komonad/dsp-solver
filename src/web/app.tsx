import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadGameDataFromURL } from '../data/loader';
import type { GameData, Recipe } from '../types';
import { solveMultiDemand, type MultiDemandResult } from '../core/multiDemandSolver';
import { buildLayeredRecipeBuildings } from '../core/autoBuilding';
import { buildResultModel } from './resultModel';

const DATA_CONFIGS = {
  vanilla: { name: '原版 (Vanilla)', file: './Vanilla.json' },
  test: { name: '测试配置 (Test)', file: './TestConfig.json' },
  refinery: { name: '炼油测试 (Refinery)', file: './Refinery.json' },
} as const;

type ConfigKey = keyof typeof DATA_CONFIGS;
type Demand = { itemId: string; rate: number };

const STORAGE_KEY = 'dsp-react-state';

function App() {
  const [configKey, setConfigKey] = useState<ConfigKey>('test');
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [demands, setDemands] = useState<Demand[]>([{ itemId: '11005', rate: 60 }]);
  const [draftItemId, setDraftItemId] = useState('11005');
  const [draftRate, setDraftRate] = useState(60);
  const [treatAsRaw, setTreatAsRaw] = useState<string[]>([]);
  const [manualRecipeBuildings, setManualRecipeBuildings] = useState<Record<string, string>>({});
  const [selectedRecipes, setSelectedRecipes] = useState<Record<string, string>>({});
  const [pendingWarning, setPendingWarning] = useState('');
  const [result, setResult] = useState<MultiDemandResult | null>(null);
  const [error, setError] = useState('');
  const [resolvedRecipeBuildings, setResolvedRecipeBuildings] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.configKey) setConfigKey(parsed.configKey);
      if (parsed.demands) setDemands(parsed.demands);
      if (parsed.treatAsRaw) setTreatAsRaw(parsed.treatAsRaw);
      if (parsed.manualRecipeBuildings) setManualRecipeBuildings(parsed.manualRecipeBuildings);
      if (parsed.selectedRecipes) setSelectedRecipes(parsed.selectedRecipes);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      configKey,
      demands,
      treatAsRaw,
      manualRecipeBuildings,
      selectedRecipes,
    }));
  }, [configKey, demands, treatAsRaw, manualRecipeBuildings, selectedRecipes]);

  useEffect(() => {
    loadGameDataFromURL(DATA_CONFIGS[configKey].file)
      .then(data => {
        setGameData(data);
        setError('');
        if (data.items.length > 0 && !data.itemMap.has(draftItemId)) {
          setDraftItemId(data.items[0].id);
        }
      })
      .catch(err => {
        setError(String(err));
        setGameData(null);
      });
  }, [configKey]);

  useEffect(() => {
    if (!gameData) return;
    if (demands.length === 0) {
      setResolvedRecipeBuildings(new Map());
      setResult(null);
      setError('');
      return;
    }

    const autoBuildings = buildLayeredRecipeBuildings(gameData, demands.map(d => d.itemId));
    const mergedBuildings = new Map(autoBuildings);
    for (const [recipeId, buildingId] of Object.entries(manualRecipeBuildings)) {
      mergedBuildings.set(recipeId, buildingId);
    }

    setResolvedRecipeBuildings(mergedBuildings);

    const solveOptions = {
      treatAsRaw,
      existingSupplies: [],
      selectedRecipes: new Map(Object.entries(selectedRecipes)),
      noByproducts: false,
      recipeProliferators: new Map(),
      recipeBuildings: mergedBuildings,
    };
    
    // 输出求解输入到控制台
    console.log('=== 求解输入 ===');
    console.log('需求:', demands.map(d => ({ 
      itemName: gameData.itemMap.get(d.itemId)?.name || d.itemId, 
      itemId: d.itemId, 
      rate: d.rate 
    })));
    console.log('标记为原矿的物品:', treatAsRaw.map(id => ({
      itemName: gameData.itemMap.get(id)?.name || id,
      itemId: id
    })));
    console.log('选择的配方:', selectedRecipes);
    console.log('配方建筑配置:', Object.fromEntries(mergedBuildings));
    
    const solveResult = solveMultiDemand(demands, gameData, solveOptions);

    // 输出求解结果到控制台
    console.log('=== 求解输出 ===');
    console.log('是否可行:', solveResult.feasible);
    if (solveResult.feasible) {
      console.log('配方速率:', Object.fromEntries(solveResult.recipeRatesPerMinute || solveResult.recipes));
      console.log('原料:', Object.fromEntries(solveResult.rawMaterials));
    } else {
      console.log('错误信息:', solveResult.message);
    }

    setResult(solveResult);
    setError(solveResult.feasible ? '' : (solveResult.message || '求解失败'));
    (window as any).__DSP_LAST_SOLVE_REQUEST__ = {
      demands,
      options: {
        treatAsRaw,
        selectedRecipes: Object.entries(selectedRecipes),
        recipeBuildings: Array.from(mergedBuildings.entries()),
      },
    };
  }, [gameData, demands, treatAsRaw, manualRecipeBuildings, selectedRecipes]);

  const resultModel = useMemo(() => {
    if (!gameData || !result) return null;
    return buildResultModel(result, gameData, resolvedRecipeBuildings);
  }, [gameData, result, resolvedRecipeBuildings]);

  const editableRecipeRows = useMemo(() => {
    if (!gameData || !resultModel) return [] as Array<{ recipeId: string; recipeName: string; buildingId: string }>;

    // 只展示在 resultModel.recipes 中的配方，也就是实际被使用的配方
    const rows: Array<{ recipeId: string; recipeName: string; buildingId: string }> = [];

    for (const row of resultModel.recipes) {
      rows.push({ recipeId: row.recipeId, recipeName: row.recipeName, buildingId: row.buildingId });
    }

    return rows;
  }, [gameData, resultModel]);

  const producerOptions = useMemo(() => {
    if (!gameData) return new Map<string, Recipe[]>();
    const map = new Map<string, Recipe[]>();
    for (const item of gameData.items) {
      map.set(item.id, gameData.itemToRecipes.get(item.id) || []);
    }
    return map;
  }, [gameData]);

  function addDemand() {
    if (!draftItemId || draftRate <= 0) return;
    setDemands(prev => {
      const existing = prev.find(d => d.itemId === draftItemId);
      if (existing) {
        return prev.map(d => d.itemId === draftItemId ? { ...d, rate: draftRate } : d);
      }
      return [...prev, { itemId: draftItemId, rate: draftRate }];
    });
  }

  function removeDemand(itemId: string) {
    setDemands(prev => prev.filter(d => d.itemId !== itemId));
  }

  function tryApplyConfig(next: {
    selectedRecipes?: Record<string, string>;
    manualRecipeBuildings?: Record<string, string>;
    treatAsRaw?: string[];
  }) {
    if (!gameData || demands.length === 0) return;

    const candidateRecipes = next.selectedRecipes ?? selectedRecipes;
    const candidateBuildings = next.manualRecipeBuildings ?? manualRecipeBuildings;
    const candidateRaw = next.treatAsRaw ?? treatAsRaw;

    const autoBuildings = buildLayeredRecipeBuildings(gameData, demands.map(d => d.itemId));
    const mergedBuildings = new Map(autoBuildings);
    for (const [recipeId, buildingId] of Object.entries(candidateBuildings)) {
      mergedBuildings.set(recipeId, buildingId);
    }

    const solveResult = solveMultiDemand(demands, gameData, {
      treatAsRaw: candidateRaw,
      existingSupplies: [],
      selectedRecipes: new Map(Object.entries(candidateRecipes)),
      noByproducts: false,
      recipeProliferators: new Map(),
      recipeBuildings: mergedBuildings,
    });

    if (!solveResult.feasible) {
      setPendingWarning(solveResult.message || '修改后的配置无解，未应用。');
      return;
    }

    setPendingWarning('');
    if (next.selectedRecipes) setSelectedRecipes(candidateRecipes);
    if (next.manualRecipeBuildings) setManualRecipeBuildings(candidateBuildings);
    if (next.treatAsRaw) setTreatAsRaw(candidateRaw);
  }

  function clearStoredState() {
    localStorage.removeItem(STORAGE_KEY);
    setConfigKey('test');
    setDemands([{ itemId: '11005', rate: 60 }]);
    setDraftItemId('11005');
    setDraftRate(60);
    setTreatAsRaw([]);
    setManualRecipeBuildings({});
    setSelectedRecipes({});
    setResolvedRecipeBuildings(new Map());
    setResult(null);
    setError('');
    setPendingWarning('');
  }

  // 计算总结数据（只包含净输入）
  const summaryData = useMemo(() => {
    if (!resultModel) return null;
    
    // 净输入就是原料列表，按速率降序排序
    const netInputs = [...resultModel.rawMaterials]
      .sort((a, b) => b.rate - a.rate);
    
    return { netInputs };
  }, [resultModel]);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', color: '#eee', fontFamily: 'sans-serif', padding: 20, display: 'flex', flexDirection: 'column' }}>
      <h1>DSP 配方求解器</h1>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
        <div style={{ border: '1px solid #444', borderRadius: 8, padding: 12 }}>
          <h2>配置</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select value={configKey} onChange={e => setConfigKey(e.target.value as ConfigKey)}>
              {Object.entries(DATA_CONFIGS).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
            </select>
            <select value={draftItemId} onChange={e => setDraftItemId(e.target.value)}>
              {(gameData?.items || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input type="number" value={draftRate} onChange={e => setDraftRate(Number(e.target.value) || 0)} />
            <button onClick={addDemand}>添加需求</button>
            <button onClick={clearStoredState}>清除缓存</button>
          </div>
        </div>

        <div style={{ border: '1px solid #444', borderRadius: 8, padding: 12 }}>
          <h2>需求列表</h2>
          {demands.map(demand => (
            <div key={demand.itemId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{gameData?.itemMap.get(demand.itemId)?.name || demand.itemId}: {demand.rate.toFixed(2)}/min</span>
              <button onClick={() => removeDemand(demand.itemId)}>删除</button>
            </div>
          ))}
        </div>
      </div>

      {error && <div style={{ color: '#ff6b6b', marginBottom: 16 }}>求解失败: {error}</div>}
      {pendingWarning && <div style={{ color: '#ffd166', marginBottom: 16 }}>{pendingWarning}</div>}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr' }}>
        <div style={{ border: '1px solid #444', borderRadius: 8, padding: 12 }}>
          <h2>原料 / 原矿切换</h2>
          {resultModel?.rawMaterials.map(raw => (
            <label key={raw.itemId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{raw.itemName}: {raw.rate.toFixed(2)}/min</span>
              <input
                type="checkbox"
                checked={treatAsRaw.includes(raw.itemId)}
                onChange={() => tryApplyConfig({
                  treatAsRaw: treatAsRaw.includes(raw.itemId)
                    ? treatAsRaw.filter(id => id !== raw.itemId)
                    : [...treatAsRaw, raw.itemId],
                })}
              />
            </label>
          ))}
        </div>
      </div>

      {result?.feasible && (
        <div style={{ marginTop: 20, display: 'flex', gap: 20 }}>
          {/* 左侧配方结果 */}
          <div style={{ flex: 1 }}>
            <h2>配方结果</h2>
            {editableRecipeRows.map(row => {
              const recipe = gameData?.recipeMap.get(row.recipeId);
              const resultRow = resultModel?.recipes.find(item => item.recipeId === row.recipeId);
              const availableBuildings = recipe
                ? gameData?.buildings.filter(b => recipe.factoryIds.includes(b.originalId)) || []
                : [];
              const productItemId = recipe?.outputs[0]?.itemId;
              const recipeChoices = productItemId ? (producerOptions.get(productItemId) || []) : [];

              return (
                <div key={row.recipeId} style={{ border: '1px solid #444', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{resultRow?.recipeName || row.recipeName}</strong>
                    <span>{resultRow ? `${resultRow.buildingCount.toFixed(2)} 个 ${resultRow.buildingName}` : '未生效'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                    {recipeChoices.length > 1 && productItemId && (
                      <label>
                        <span style={{ marginRight: 6 }}>配方</span>
                        <select
                          value={selectedRecipes[productItemId] || row.recipeId}
                          onChange={e => tryApplyConfig({ selectedRecipes: { ...selectedRecipes, [productItemId]: e.target.value } })}
                        >
                          {recipeChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
                        </select>
                      </label>
                    )}

                    {availableBuildings.length > 0 && (
                      <label>
                        <span style={{ marginRight: 6 }}>建筑</span>
                        <select
                          value={manualRecipeBuildings[row.recipeId] || row.buildingId}
                          onChange={e => tryApplyConfig({ manualRecipeBuildings: { ...manualRecipeBuildings, [row.recipeId]: e.target.value } })}
                        >
                          {availableBuildings.map(building => <option key={building.id} value={building.id}>{building.name}</option>)}
                        </select>
                      </label>
                    )}

                    {/* 原矿标注功能 */}
                    {resultRow && productItemId && (
                      <label>
                        <span style={{ marginRight: 6 }}>标记为原矿</span>
                        <input
                          type="checkbox"
                          checked={treatAsRaw.includes(productItemId)}
                          onChange={() => tryApplyConfig({
                            treatAsRaw: treatAsRaw.includes(productItemId)
                              ? treatAsRaw.filter(id => id !== productItemId)
                              : [...treatAsRaw, productItemId],
                          })}
                        />
                      </label>
                    )}
                  </div>

                  {resultRow ? (
                    <>
                      <div style={{ color: '#9ad', marginTop: 8 }}>执行次数: {resultRow.executionsPerMinute.toFixed(2)}/min</div>
                      <div style={{ color: '#9ad' }}>单建筑执行: {resultRow.perBuildingExecutionsPerMinute.toFixed(2)}/min</div>
                      <div style={{ marginTop: 8 }}>
                        <div>输入: {resultRow.inputs.map(item => `${item.itemName} ${item.rate.toFixed(2)}/min`).join(' | ')}</div>
                        <div>输出: {resultRow.outputs.map(item => `${item.itemName} ${item.rate.toFixed(2)}/min`).join(' | ')}</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#ffd166', marginTop: 8 }}>当前解中未使用该配方，但仍可在此修改。</div>
                  )}
                </div>
              );
            })}

            <h2>原料</h2>
            {resultModel?.rawMaterials.map(raw => (
              <div key={raw.itemId}>{raw.itemName}: {raw.rate.toFixed(2)}/min</div>
            ))}
          </div>

          {/* 右侧侧边栏 */}
          <div style={{ width: 300, border: '1px solid #444', borderRadius: 8, padding: 12, height: 'fit-content' }}>
            <h2>总结数据</h2>
            
            <div style={{ marginBottom: 16 }}>
              <h3>净输入（原料）</h3>
              {summaryData?.netInputs.map(raw => (
                <div key={raw.itemId} style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{raw.itemName}: {raw.rate.toFixed(2)}/min</span>
                  {treatAsRaw.includes(raw.itemId) && (
                    <button 
                      onClick={() => tryApplyConfig({
                        treatAsRaw: treatAsRaw.filter(id => id !== raw.itemId)
                      })}
                      style={{ fontSize: '12px', padding: '2px 6px' }}
                    >
                      取消标记
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <h3>已标记为原矿的物品</h3>
              {treatAsRaw.length > 0 ? (
                treatAsRaw.map(itemId => {
                  const itemName = gameData?.itemMap.get(itemId)?.name || itemId;
                  return (
                    <div key={itemId} style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{itemName}</span>
                      <button 
                        onClick={() => tryApplyConfig({
                          treatAsRaw: treatAsRaw.filter(id => id !== itemId)
                        })}
                        style={{ fontSize: '12px', padding: '2px 6px' }}
                      >
                        取消标记
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: '#999' }}>暂无标记为原矿的物品</div>
              )}
            </div>
            
            <div>
              <h3>配方数量</h3>
              <div>{resultModel?.recipes.length || 0} 个配方</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById('app') || (() => {
  const element = document.createElement('div');
  element.id = 'app';
  document.body.innerHTML = '';
  document.body.appendChild(element);
  return element;
})();

createRoot(rootElement).render(<App />);
