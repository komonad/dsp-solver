import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { copyText } from '../../shared/copyText';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';

type CopyState = 'idle' | 'copied' | 'failed';

export default function CopySolveRequestJsonButton() {
  const { bundle } = useCatalog();
  const { activeSolveRequest } = useSolve();
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const requestJsonText = useMemo(
    () => (activeSolveRequest ? JSON.stringify(activeSolveRequest, null, 2) : ''),
    [activeSolveRequest]
  );

  const copySolveRequestJson = useCallback(async () => {
    if (!requestJsonText) {
      return;
    }

    setCopyState((await copyText(requestJsonText)) ? 'copied' : 'failed');
  }, [requestJsonText]);

  useEffect(() => {
    setCopyState('idle');
  }, [requestJsonText]);

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setCopyState('idle'), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  const label =
    copyState === 'copied'
      ? bundle.diagnostics.copySolveRequestJsonDone
      : copyState === 'failed'
        ? bundle.diagnostics.copySolveRequestJsonFailed
        : bundle.diagnostics.copySolveRequestJson;

  return (
    <Button
      variant="outlined"
      size="small"
      onClick={copySolveRequestJson}
      disabled={!requestJsonText}
      sx={{ minWidth: 0, flexShrink: 0 }}
    >
      {label}
    </Button>
  );
}
