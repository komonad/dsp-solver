import { Box, Typography } from '@mui/material';
import { formatPower } from '../../../i18n';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';

export default function SummaryMetrics() {
  const { bundle, locale } = useCatalog();
  const { model } = useSolve();
  const summary = model?.solvedSummary;
  if (!summary) return null;
  const metrics = [
    { label: bundle.summary.buildingsLabel, value: summary.roundedBuildingCount.toLocaleString(locale) },
    { label: bundle.summary.recipesLabel, value: summary.recipeTypeCount.toLocaleString(locale) },
    { label: bundle.overview.powerLabel, value: formatPower(summary.roundedPlacementPowerMW, locale) },
  ];
  return (
    <Box data-testid="summary-metrics" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mt: 1 }}>
      {metrics.map(metric => (
        <Box key={metric.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{metric.label}</Typography>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 650 }}>{metric.value}</Typography>
        </Box>
      ))}
    </Box>
  );
}
