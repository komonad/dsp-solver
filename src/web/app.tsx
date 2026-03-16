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
  const [result, setResult] = useState<MultiDemandResult | null>(null);
  const [error, setError] = useState<string>('');
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
    if (!gameData || demands.length === 0) return;

    const autoBuildings = buildLayeredRecipeBuildings(gameData, demands.map(d => d.itemId));
    const mergedBuildings = new Map(autoBuildings);
    for (const [recipeId, buildingId] of Object.entries(manualRecipeBuildings)) {
      mergedBuildings.set(recipeId, buildingId);
    }

    setResolvedRecipeBuildings(mergedBuildings);

    const solveResult = solveMultiDemand(
      demands,
      gameData,
      {
        treatAsRaw,
        existingSupplies: [],
        selectedRecipes: new Map(Object.entries(selectedRecipes)),
        noByproducts: false,
        recipeProliferators: new Map(),
        recipeBuildings: mergedBuildings,
      }
    );

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

  function toggleRaw(itemId: string) {
    setTreatAsRaw(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', color: '#eee', fontFamily: 'sans-serif', padding: 20 }}>
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

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ border: '1px solid #444', borderRadius: 8, padding: 12 }}>
          <h2>原料 / 原矿切换</h2>
          {resultModel?.rawMaterials.map(raw => (
            <label key={raw.itemId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{raw.itemName}: {raw.rate.toFixed(2)}/min</span>
              <input type="checkbox" checked={treatAsRaw.includes(raw.itemId)} onChange={() => toggleRaw(raw.itemId)} />
            </label>
          ))}
        </div>

        <div style={{ border: '1px solid #444', borderRadius: 8, padding: 12 }}>
          <h2>手动建筑 / 配方</h2>
          {resultModel?.recipes.map(row => {
            const recipe = gameData?.recipeMap.get(row.recipeId);
            const availableBuildings = recipe
              ? gameData?.buildings.filter(b => recipe.factoryIds.includes(b.originalId)) || []
              : [];
            const productItemId = recipe?.outputs[0]?.itemId;
            const recipeChoices = productItemId ? (producerOptions.get(productItemId) || []) : [];
            return (
              <div key={row.recipeId} style={{ marginBottom: 12, borderTop: '1px solid #333', paddingTop: 8 }}>
                <div>{row.recipeName}</div>
                {recipeChoices.length > 1 && productItemId && (
                  <select
                    value={selectedRecipes[productItemId] || row.recipeId}
                    onChange={e => setSelectedRecipes(prev => ({ ...prev, [productItemId]: e.target.value }))}
                  >
                    {recipeChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
                  </select>
                )}
                {availableBuildings.length > 0 && (
                  <select
                    value={manualRecipeBuildings[row.recipeId] || row.buildingId}
                    onChange={e => setManualRecipeBuildings(prev => ({ ...prev, [row.recipeId]: e.target.value }))}
                  >
                    {availableBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {result?.feasible && (
        <div style={{ marginTop: 20 }}>
          <h2>配方结果</h2>
          {resultModel?.recipes.map(row => (
            <div key={row.recipeId} style={{ border: '1px solid #444', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{row.recipeName}</strong>
                <span>{row.buildingCount.toFixed(2)} 个 {row.buildingName}</span>
              </div>
              <div style={{ color: '#9ad' }}>执行次数: {row.executionsPerMinute.toFixed(2)}/min</div>
              <div style={{ color: '#9ad' }}>单建筑执行: {row.perBuildingExecutionsPerMinute.toFixed(2)}/min</div>
              <div style={{ marginTop: 8 }}>
                <div>输入: {row.inputs.map(x => `${x.itemName} ${x.rate.toFixed(2)}/min`).join(' | ')}</div>
                <div>输出: {row.outputs.map(x => `${x.itemName} ${x.rate.toFixed(2)}/min`).join(' | ')}</div>
              </div>
            </div>
          ))}

          <h2>原料</h2>
          {resultModel?.rawMaterials.map(raw => (
            <div key={raw.itemId}>{raw.itemName}: {raw.rate.toFixed(2)}/min</div>
          ))}
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
