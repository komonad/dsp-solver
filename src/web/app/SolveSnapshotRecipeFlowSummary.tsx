import { Box } from '@mui/material';
import type { ResolvedCatalogModel, ResolvedRecipeSpec } from '../../catalog';
import type { AppLocale } from '../../i18n';
import RecipeCycleArrow from './RecipeCycleArrow';
import { RecipeIoSequence } from './FlowRateDisplay';

export interface SolveSnapshotRecipeFlowSummaryProps {
  recipe: ResolvedRecipeSpec;
  locale: AppLocale;
  atlasIds?: string[];
  noneText: string;
  catalog: ResolvedCatalogModel | null;
}

export default function SolveSnapshotRecipeFlowSummary({
  recipe,
  locale,
  atlasIds,
  noneText,
  catalog,
}: SolveSnapshotRecipeFlowSummaryProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        flexWrap: 'wrap',
        minWidth: 0,
        maxWidth: '100%',
        flex: '1 1 auto',
      }}
    >
      <Box sx={{ minWidth: 0, display: 'flex', maxWidth: '100%' }}>
        <RecipeIoSequence
          items={recipe.inputs.map(io => {
            const item = catalog?.itemMap.get(io.itemId);
            return {
              itemId: io.itemId,
              itemName: item?.name ?? io.itemId,
              iconKey: item?.icon,
              ratePerMin: io.amount,
            };
          })}
          locale={locale}
          atlasIds={atlasIds}
          noneText={noneText}
        />
      </Box>
      <RecipeCycleArrow cycleTimeSec={recipe.cycleTimeSec} locale={locale} />
      <Box sx={{ minWidth: 0, display: 'flex', maxWidth: '100%' }}>
        <RecipeIoSequence
          items={recipe.outputs.map(io => {
            const item = catalog?.itemMap.get(io.itemId);
            return {
              itemId: io.itemId,
              itemName: item?.name ?? io.itemId,
              iconKey: item?.icon,
              ratePerMin: io.amount,
            };
          })}
          locale={locale}
          atlasIds={atlasIds}
          noneText={noneText}
        />
      </Box>
    </Box>
  );
}
