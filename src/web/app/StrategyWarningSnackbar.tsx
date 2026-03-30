import React from 'react';
import { Alert, Snackbar } from '@mui/material';
import { useWorkbenchDraft } from './WorkbenchDraftContext';

export default function StrategyWarningSnackbar() {
  const { recipeStrategyWarning, setRecipeStrategyWarning } = useWorkbenchDraft();

  return (
    <Snackbar
      open={Boolean(recipeStrategyWarning)}
      autoHideDuration={3600}
      onClose={() => setRecipeStrategyWarning('')}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="warning"
        variant="filled"
        onClose={() => setRecipeStrategyWarning('')}
        sx={{ width: '100%' }}
      >
        {recipeStrategyWarning}
      </Alert>
    </Snackbar>
  );
}
