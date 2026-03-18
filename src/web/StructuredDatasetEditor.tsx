import React, { useEffect, useMemo, useState } from 'react';
import type {
  CatalogBuildingRuleSpec,
  CatalogDefaultConfigSpec,
  VanillaItemRecord,
  VanillaRecipeRecord,
} from '../catalog';
import {
  buildEditableBuildingEntries,
  createEditableBuildingRule,
  createEditableItem,
  createEditableRecipe,
  parseEditableCatalogSource,
  removeEditableBuildingRule,
  removeEditableItem,
  removeEditableRecipe,
  stringifyEditableCatalogSource,
  upsertEditableBuildingRule,
  upsertEditableItem,
  upsertEditableRecipe,
  type EditableBuildingEntry,
  type EditableCatalogSource,
} from './catalogEditor';

type StructuredEditorTab = 'items' | 'recipes' | 'building-rules' | 'defaults';

interface StructuredDatasetEditorProps {
  title: string;
  helpText: string;
  unavailableText: string;
  tabs: {
    items: string;
    recipes: string;
    buildingRules: string;
    defaults: string;
  };
  actions: {
    add: string;
    remove: string;
  };
  datasetText: string;
  defaultConfigText: string;
  onSourceTextsChange: (datasetText: string, defaultConfigText: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 38,
  borderRadius: 10,
  border: '1px solid rgba(24, 51, 89, 0.18)',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.94)',
  color: '#183359',
  boxSizing: 'border-box',
};

const compactButtonStyle: React.CSSProperties = {
  minHeight: 34,
  borderRadius: 10,
  border: '1px solid rgba(24, 51, 89, 0.16)',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: 'rgba(24, 51, 89, 0.08)',
  color: '#183359',
};

function parseNumberList(value: string): number[] {
  return value
    .split(/[,\n]/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => Number(entry))
    .filter(entry => Number.isFinite(entry));
}

function parseStringList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function stringifyNumberList(values: number[]): string {
  return values.join(', ');
}

function stringifyStringList(values?: string[]): string {
  return (values ?? []).join(', ');
}

function commitSource(
  nextSource: EditableCatalogSource,
  onSourceTextsChange: StructuredDatasetEditorProps['onSourceTextsChange']
) {
  const serialized = stringifyEditableCatalogSource(nextSource);
  onSourceTextsChange(serialized.datasetText, serialized.defaultConfigText);
}

function DetailField(props: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{props.label}</div>
      {props.children}
    </label>
  );
}

function ItemEditor(props: {
  source: EditableCatalogSource;
  selectedItemId: number | null;
  onSelectItemId: (itemId: number | null) => void;
  actions: StructuredDatasetEditorProps['actions'];
  onSourceTextsChange: StructuredDatasetEditorProps['onSourceTextsChange'];
}) {
  const { source, selectedItemId, onSelectItemId, actions, onSourceTextsChange } = props;
  const items = useMemo(
    () => source.dataset.items.slice().sort((left, right) => left.ID - right.ID),
    [source]
  );
  const selectedItem = items.find(item => item.ID === selectedItemId) ?? items[0] ?? null;

  useEffect(() => {
    if (!selectedItem) {
      onSelectItemId(null);
      return;
    }
    if (selectedItemId !== selectedItem.ID) {
      onSelectItemId(selectedItem.ID);
    }
  }, [onSelectItemId, selectedItem, selectedItemId]);

  function updateItem(patch: Partial<VanillaItemRecord>) {
    if (!selectedItem) {
      return;
    }
    commitSource(upsertEditableItem(source, { ...selectedItem, ...patch }), onSourceTextsChange);
  }

  function addItem() {
    const nextItem = createEditableItem(source);
    const nextSource = upsertEditableItem(source, nextItem);
    onSelectItemId(nextItem.ID);
    commitSource(nextSource, onSourceTextsChange);
  }

  function removeItem() {
    if (!selectedItem) {
      return;
    }
    commitSource(removeEditableItem(source, selectedItem.ID), onSourceTextsChange);
    onSelectItemId(null);
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={compactButtonStyle} onClick={addItem}>
            {actions.add}
          </button>
          <button type="button" style={compactButtonStyle} onClick={removeItem} disabled={!selectedItem}>
            {actions.remove}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflow: 'auto' }}>
          {items.map(item => (
            <button
              key={item.ID}
              type="button"
              onClick={() => onSelectItemId(item.ID)}
              style={{
                ...compactButtonStyle,
                textAlign: 'left',
                justifyContent: 'flex-start',
                background:
                  item.ID === selectedItem?.ID ? 'rgba(24, 51, 89, 0.16)' : 'rgba(24, 51, 89, 0.06)',
              }}
            >
              {item.Name} #{item.ID}
            </button>
          ))}
        </div>
      </div>

      {selectedItem ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <DetailField label="ID">
            <input
              value={selectedItem.ID}
              type="number"
              onChange={event => updateItem({ ID: Number(event.target.value) || 0 })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Type">
            <input
              value={selectedItem.Type}
              type="number"
              onChange={event => updateItem({ Type: Number(event.target.value) || 0 })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Name">
            <input
              value={selectedItem.Name}
              onChange={event => updateItem({ Name: event.target.value })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="IconName">
            <input
              value={selectedItem.IconName}
              onChange={event => updateItem({ IconName: event.target.value })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="GridIndex">
            <input
              value={selectedItem.GridIndex ?? ''}
              type="number"
              onChange={event =>
                updateItem({
                  GridIndex: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="WorkEnergyPerTick">
            <input
              value={selectedItem.WorkEnergyPerTick ?? ''}
              type="number"
              onChange={event =>
                updateItem({
                  WorkEnergyPerTick: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Speed">
            <input
              value={selectedItem.Speed ?? ''}
              type="number"
              onChange={event =>
                updateItem({
                  Speed: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Space">
            <input
              value={selectedItem.Space ?? ''}
              type="number"
              onChange={event =>
                updateItem({
                  Space: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="MultipleOutput">
            <input
              value={selectedItem.MultipleOutput ?? ''}
              type="number"
              onChange={event =>
                updateItem({
                  MultipleOutput: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
        </div>
      ) : null}
    </div>
  );
}

function RecipeEditor(props: {
  source: EditableCatalogSource;
  selectedRecipeId: number | null;
  onSelectRecipeId: (recipeId: number | null) => void;
  actions: StructuredDatasetEditorProps['actions'];
  onSourceTextsChange: StructuredDatasetEditorProps['onSourceTextsChange'];
}) {
  const { source, selectedRecipeId, onSelectRecipeId, actions, onSourceTextsChange } = props;
  const recipes = useMemo(
    () => source.dataset.recipes.slice().sort((left, right) => left.ID - right.ID),
    [source]
  );
  const selectedRecipe = recipes.find(recipe => recipe.ID === selectedRecipeId) ?? recipes[0] ?? null;

  useEffect(() => {
    if (!selectedRecipe) {
      onSelectRecipeId(null);
      return;
    }
    if (selectedRecipeId !== selectedRecipe.ID) {
      onSelectRecipeId(selectedRecipe.ID);
    }
  }, [onSelectRecipeId, selectedRecipe, selectedRecipeId]);

  function updateRecipe(patch: Partial<VanillaRecipeRecord>) {
    if (!selectedRecipe) {
      return;
    }
    commitSource(upsertEditableRecipe(source, { ...selectedRecipe, ...patch }), onSourceTextsChange);
  }

  function addRecipe() {
    const nextRecipe = createEditableRecipe(source);
    const nextSource = upsertEditableRecipe(source, nextRecipe);
    onSelectRecipeId(nextRecipe.ID);
    commitSource(nextSource, onSourceTextsChange);
  }

  function removeRecipe() {
    if (!selectedRecipe) {
      return;
    }
    commitSource(removeEditableRecipe(source, selectedRecipe.ID), onSourceTextsChange);
    onSelectRecipeId(null);
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={compactButtonStyle} onClick={addRecipe}>
            {actions.add}
          </button>
          <button type="button" style={compactButtonStyle} onClick={removeRecipe} disabled={!selectedRecipe}>
            {actions.remove}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflow: 'auto' }}>
          {recipes.map(recipe => (
            <button
              key={recipe.ID}
              type="button"
              onClick={() => onSelectRecipeId(recipe.ID)}
              style={{
                ...compactButtonStyle,
                textAlign: 'left',
                justifyContent: 'flex-start',
                background:
                  recipe.ID === selectedRecipe?.ID
                    ? 'rgba(24, 51, 89, 0.16)'
                    : 'rgba(24, 51, 89, 0.06)',
              }}
            >
              {recipe.Name} #{recipe.ID}
            </button>
          ))}
        </div>
      </div>

      {selectedRecipe ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <DetailField label="ID">
            <input
              value={selectedRecipe.ID}
              type="number"
              onChange={event => updateRecipe({ ID: Number(event.target.value) || 0 })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Type">
            <input
              value={selectedRecipe.Type}
              type="number"
              onChange={event => updateRecipe({ Type: Number(event.target.value) || 0 })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Name">
            <input
              value={selectedRecipe.Name}
              onChange={event => updateRecipe({ Name: event.target.value })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="IconName">
            <input
              value={selectedRecipe.IconName}
              onChange={event => updateRecipe({ IconName: event.target.value })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="TimeSpend">
            <input
              value={selectedRecipe.TimeSpend}
              type="number"
              onChange={event => updateRecipe({ TimeSpend: Number(event.target.value) || 0 })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Proliferator">
            <input
              value={selectedRecipe.Proliferator}
              type="number"
              onChange={event => updateRecipe({ Proliferator: Number(event.target.value) || 0 })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Factories">
            <textarea
              key={`${selectedRecipe.ID}-Factories`}
              defaultValue={stringifyNumberList(selectedRecipe.Factories)}
              onBlur={event => updateRecipe({ Factories: parseNumberList(event.target.value) })}
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            />
          </DetailField>
          <DetailField label="Items">
            <textarea
              key={`${selectedRecipe.ID}-Items`}
              defaultValue={stringifyNumberList(selectedRecipe.Items)}
              onBlur={event => updateRecipe({ Items: parseNumberList(event.target.value) })}
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            />
          </DetailField>
          <DetailField label="ItemCounts">
            <textarea
              key={`${selectedRecipe.ID}-ItemCounts`}
              defaultValue={stringifyNumberList(selectedRecipe.ItemCounts)}
              onBlur={event => updateRecipe({ ItemCounts: parseNumberList(event.target.value) })}
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            />
          </DetailField>
          <DetailField label="Results">
            <textarea
              key={`${selectedRecipe.ID}-Results`}
              defaultValue={stringifyNumberList(selectedRecipe.Results)}
              onBlur={event => updateRecipe({ Results: parseNumberList(event.target.value) })}
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            />
          </DetailField>
          <DetailField label="ResultCounts">
            <textarea
              key={`${selectedRecipe.ID}-ResultCounts`}
              defaultValue={stringifyNumberList(selectedRecipe.ResultCounts)}
              onBlur={event => updateRecipe({ ResultCounts: parseNumberList(event.target.value) })}
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            />
          </DetailField>
        </div>
      ) : null}
    </div>
  );
}

function BuildingRuleEditor(props: {
  source: EditableCatalogSource;
  selectedBuildingId: number | null;
  onSelectBuildingId: (buildingId: number | null) => void;
  actions: StructuredDatasetEditorProps['actions'];
  onSourceTextsChange: StructuredDatasetEditorProps['onSourceTextsChange'];
}) {
  const { source, selectedBuildingId, onSelectBuildingId, actions, onSourceTextsChange } = props;
  const buildingEntries = useMemo(() => buildEditableBuildingEntries(source), [source]);
  const selectedEntry =
    buildingEntries.find(entry => entry.id === selectedBuildingId) ?? buildingEntries[0] ?? null;
  const selectedRule: CatalogBuildingRuleSpec | null = selectedEntry?.rule
    ? { ...selectedEntry.rule, Tags: selectedEntry.rule.Tags ? [...selectedEntry.rule.Tags] : undefined }
    : selectedEntry
      ? { ID: selectedEntry.id, Category: 'factory' }
      : null;

  useEffect(() => {
    if (!selectedEntry) {
      onSelectBuildingId(null);
      return;
    }
    if (selectedBuildingId !== selectedEntry.id) {
      onSelectBuildingId(selectedEntry.id);
    }
  }, [onSelectBuildingId, selectedBuildingId, selectedEntry]);

  function updateRule(patch: Partial<CatalogBuildingRuleSpec>) {
    if (!selectedRule) {
      return;
    }
    commitSource(
      upsertEditableBuildingRule(source, {
        ...selectedRule,
        ...patch,
      }),
      onSourceTextsChange
    );
  }

  function addRule() {
    const nextRule = createEditableBuildingRule(source);
    onSelectBuildingId(nextRule.ID);
    commitSource(upsertEditableBuildingRule(source, nextRule), onSourceTextsChange);
  }

  function removeRule() {
    if (!selectedRule) {
      return;
    }
    commitSource(removeEditableBuildingRule(source, selectedRule.ID), onSourceTextsChange);
    onSelectBuildingId(null);
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={compactButtonStyle} onClick={addRule}>
            {actions.add}
          </button>
          <button type="button" style={compactButtonStyle} onClick={removeRule} disabled={!selectedEntry?.rule}>
            {actions.remove}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflow: 'auto' }}>
          {buildingEntries.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelectBuildingId(entry.id)}
              style={{
                ...compactButtonStyle,
                textAlign: 'left',
                justifyContent: 'flex-start',
                background:
                  entry.id === selectedEntry?.id ? 'rgba(24, 51, 89, 0.16)' : 'rgba(24, 51, 89, 0.06)',
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {selectedRule ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <DetailField label="ID">
            <input value={selectedRule.ID} type="number" readOnly style={inputStyle} />
          </DetailField>
          <DetailField label="Category">
            <input
              value={selectedRule.Category ?? ''}
              onChange={event => updateRule({ Category: event.target.value })}
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="IntrinsicProductivityBonus">
            <input
              value={selectedRule.IntrinsicProductivityBonus ?? ''}
              type="number"
              onChange={event =>
                updateRule({
                  IntrinsicProductivityBonus: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="IdlePowerMW">
            <input
              value={selectedRule.IdlePowerMW ?? ''}
              type="number"
              onChange={event =>
                updateRule({
                  IdlePowerMW: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="SpeedMultiplierOverride">
            <input
              value={selectedRule.SpeedMultiplierOverride ?? ''}
              type="number"
              onChange={event =>
                updateRule({
                  SpeedMultiplierOverride: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="WorkPowerMWOverride">
            <input
              value={selectedRule.WorkPowerMWOverride ?? ''}
              type="number"
              onChange={event =>
                updateRule({
                  WorkPowerMWOverride: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              style={inputStyle}
            />
          </DetailField>
          <DetailField label="Tags">
            <textarea
              key={`${selectedRule.ID}-Tags`}
              defaultValue={stringifyStringList(selectedRule.Tags)}
              onBlur={event => updateRule({ Tags: parseStringList(event.target.value) })}
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            />
          </DetailField>
        </div>
      ) : null}
    </div>
  );
}

function DefaultsEditor(props: {
  source: EditableCatalogSource;
  onSourceTextsChange: StructuredDatasetEditorProps['onSourceTextsChange'];
}) {
  const { source, onSourceTextsChange } = props;
  const defaults = source.defaultConfig;

  function updateDefaults(patch: Partial<CatalogDefaultConfigSpec>) {
    const nextSource: EditableCatalogSource = {
      dataset: source.dataset,
      defaultConfig: {
        ...source.defaultConfig,
        ...patch,
      },
    };

    commitSource(nextSource, onSourceTextsChange);
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      <DetailField label="iconAtlasIds">
        <textarea
          key="defaults-iconAtlasIds"
          defaultValue={stringifyStringList(defaults.iconAtlasIds)}
          onBlur={event => updateDefaults({ iconAtlasIds: parseStringList(event.target.value) })}
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      </DetailField>
      <DetailField label="recommendedSolve.objective">
        <select
          value={defaults.recommendedSolve?.objective ?? ''}
          onChange={event =>
            updateDefaults({
              recommendedSolve: {
                ...defaults.recommendedSolve,
                objective: event.target.value
                  ? (event.target.value as NonNullable<CatalogDefaultConfigSpec['recommendedSolve']>['objective'])
                  : undefined,
              },
            })
          }
          style={inputStyle}
        >
          <option value="">auto</option>
          <option value="min_buildings">min_buildings</option>
          <option value="min_power">min_power</option>
          <option value="min_external_input">min_external_input</option>
        </select>
      </DetailField>
      <DetailField label="recommendedSolve.balancePolicy">
        <select
          value={defaults.recommendedSolve?.balancePolicy ?? ''}
          onChange={event =>
            updateDefaults({
              recommendedSolve: {
                ...defaults.recommendedSolve,
                balancePolicy: event.target.value
                  ? (event.target.value as NonNullable<CatalogDefaultConfigSpec['recommendedSolve']>['balancePolicy'])
                  : undefined,
              },
            })
          }
          style={inputStyle}
        >
          <option value="">auto</option>
          <option value="force_balance">force_balance</option>
          <option value="allow_surplus">allow_surplus</option>
        </select>
      </DetailField>
      <DetailField label="recommendedDisabledBuildingIds">
        <textarea
          key="defaults-recommendedDisabledBuildingIds"
          defaultValue={stringifyNumberList(defaults.recommendedDisabledBuildingIds ?? [])}
          onBlur={event =>
            updateDefaults({
              recommendedDisabledBuildingIds: parseNumberList(event.target.value),
            })
          }
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      </DetailField>
      <DetailField label="recommendedRawItemIds">
        <textarea
          key="defaults-recommendedRawItemIds"
          defaultValue={stringifyNumberList(defaults.recommendedRawItemIds ?? [])}
          onBlur={event =>
            updateDefaults({
              recommendedRawItemIds: parseNumberList(event.target.value),
            })
          }
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      </DetailField>
      <DetailField label="recommendedRawItemTypeIds">
        <textarea
          key="defaults-recommendedRawItemTypeIds"
          defaultValue={stringifyNumberList(defaults.recommendedRawItemTypeIds ?? [])}
          onBlur={event =>
            updateDefaults({
              recommendedRawItemTypeIds: parseNumberList(event.target.value),
            })
          }
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      </DetailField>
      <DetailField label="syntheticRecipeTypeIds">
        <textarea
          key="defaults-syntheticRecipeTypeIds"
          defaultValue={stringifyNumberList(defaults.syntheticRecipeTypeIds ?? [])}
          onBlur={event =>
            updateDefaults({
              syntheticRecipeTypeIds: parseNumberList(event.target.value),
            })
          }
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      </DetailField>
      <DetailField label="syntheticRecipeNamePrefixes">
        <textarea
          key="defaults-syntheticRecipeNamePrefixes"
          defaultValue={stringifyStringList(defaults.syntheticRecipeNamePrefixes)}
          onBlur={event =>
            updateDefaults({
              syntheticRecipeNamePrefixes: parseStringList(event.target.value),
            })
          }
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      </DetailField>
      <DetailField label="syntheticFactoryIds">
        <textarea
          key="defaults-syntheticFactoryIds"
          defaultValue={stringifyNumberList(defaults.syntheticFactoryIds ?? [])}
          onBlur={event =>
            updateDefaults({
              syntheticFactoryIds: parseNumberList(event.target.value),
            })
          }
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
        />
      </DetailField>
    </div>
  );
}

export default function StructuredDatasetEditor(props: StructuredDatasetEditorProps) {
  const [tab, setTab] = useState<StructuredEditorTab>('items');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);

  const parsedSource = useMemo(() => {
    try {
      return parseEditableCatalogSource(props.datasetText, props.defaultConfigText);
    } catch {
      return null;
    }
  }, [props.datasetText, props.defaultConfigText]);

  return (
    <details style={{ borderTop: '1px solid rgba(24, 51, 89, 0.10)', paddingTop: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{props.title}</summary>
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(24, 51, 89, 0.72)' }}>
          {props.helpText}
        </div>
        {parsedSource ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                ['items', props.tabs.items],
                ['recipes', props.tabs.recipes],
                ['building-rules', props.tabs.buildingRules],
                ['defaults', props.tabs.defaults],
              ] as Array<[StructuredEditorTab, string]>).map(([nextTab, label]) => (
                <button
                  key={nextTab}
                  type="button"
                  onClick={() => setTab(nextTab)}
                  style={{
                    ...compactButtonStyle,
                    background:
                      tab === nextTab ? 'rgba(24, 51, 89, 0.16)' : 'rgba(24, 51, 89, 0.06)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'items' ? (
              <ItemEditor
                source={parsedSource}
                selectedItemId={selectedItemId}
                onSelectItemId={setSelectedItemId}
                actions={props.actions}
                onSourceTextsChange={props.onSourceTextsChange}
              />
            ) : null}
            {tab === 'recipes' ? (
              <RecipeEditor
                source={parsedSource}
                selectedRecipeId={selectedRecipeId}
                onSelectRecipeId={setSelectedRecipeId}
                actions={props.actions}
                onSourceTextsChange={props.onSourceTextsChange}
              />
            ) : null}
            {tab === 'building-rules' ? (
              <BuildingRuleEditor
                source={parsedSource}
                selectedBuildingId={selectedBuildingId}
                onSelectBuildingId={setSelectedBuildingId}
                actions={props.actions}
                onSourceTextsChange={props.onSourceTextsChange}
              />
            ) : null}
            {tab === 'defaults' ? (
              <DefaultsEditor
                source={parsedSource}
                onSourceTextsChange={props.onSourceTextsChange}
              />
            ) : null}
          </>
        ) : (
          <div style={{ color: 'rgba(24, 51, 89, 0.68)', fontSize: 13 }}>{props.unavailableText}</div>
        )}
      </div>
    </details>
  );
}
