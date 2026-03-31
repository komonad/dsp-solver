import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import { Box, Button, Chip, IconButton, TextField, Typography } from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { cardStyle } from './workbenchStyles';
import { useCatalog } from './CatalogContext';
import { useWorkbench } from './WorkbenchContext';
import type { WorkbenchConfigDisplayModel } from './workbenchHelpers';

function mapConfigStatusLabel(
  status: WorkbenchConfigDisplayModel['status'],
  bundle: ReturnType<typeof useCatalog>['bundle']
): string {
  if (status === 'running') {
    return bundle.solveActivity.runningChipLabel;
  }
  if (status === 'cancelled') {
    return bundle.solveActivity.cancelledChipLabel;
  }
  if (status === 'solve_error') {
    return bundle.workbenchConfigs.solveErrorStatus;
  }
  if (status === 'idle') {
    return bundle.common.notSolvedYet;
  }

  return bundle.enums.solveStatus[status];
}

function mapConfigStatusColor(
  status: WorkbenchConfigDisplayModel['status']
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'running') {
    return 'info';
  }
  if (status === 'cancelled') {
    return 'warning';
  }
  if (status === 'solve_error' || status === 'infeasible' || status === 'invalid_input') {
    return 'error';
  }
  if (status === 'optimal') {
    return 'success';
  }
  return 'default';
}

export default function WorkbenchConfigStrip() {
  const { bundle } = useCatalog();
  const {
    workbenchConfigDisplayModels,
    activeWorkbenchConfigId,
    switchWorkbenchConfig,
    createDefaultWorkbenchConfig,
    renameWorkbenchConfig,
    forkActiveWorkbenchConfig,
    deleteWorkbenchConfig,
  } = useWorkbench();
  const [renamingConfigId, setRenamingConfigId] = useState('');
  const [renameDraft, setRenameDraft] = useState('');

  const activeConfig = useMemo(
    () =>
      workbenchConfigDisplayModels.find(config => config.id === activeWorkbenchConfigId) ?? null,
    [activeWorkbenchConfigId, workbenchConfigDisplayModels]
  );

  useEffect(() => {
    if (!renamingConfigId) {
      return;
    }

    const renamingConfig = workbenchConfigDisplayModels.find(config => config.id === renamingConfigId);
    if (!renamingConfig) {
      setRenamingConfigId('');
      setRenameDraft('');
    }
  }, [renamingConfigId, workbenchConfigDisplayModels]);

  if (workbenchConfigDisplayModels.length === 0) {
    return null;
  }

  function startRenaming(configId: string, currentName: string) {
    setRenamingConfigId(configId);
    setRenameDraft(currentName);
  }

  function commitRename() {
    if (!renamingConfigId) {
      return;
    }

    renameWorkbenchConfig(renamingConfigId, renameDraft);
    setRenamingConfigId('');
    setRenameDraft('');
  }

  function cancelRename() {
    setRenamingConfigId('');
    setRenameDraft('');
  }

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 14 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6">{bundle.workbenchConfigs.title}</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={createDefaultWorkbenchConfig}
          >
            {bundle.workbenchConfigs.createDefaultButton}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ForkRightIcon />}
            onClick={forkActiveWorkbenchConfig}
            disabled={!activeConfig}
          >
            {bundle.workbenchConfigs.forkButton}
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: {
            xs: 'minmax(232px, 85vw)',
            sm: 'minmax(248px, 280px)',
          },
          gap: 1.25,
          overflowX: 'auto',
          overflowY: 'hidden',
          pb: 0.5,
          minHeight: 0,
          scrollSnapType: 'x proximity',
        }}
      >
        {workbenchConfigDisplayModels.map(config => {
          const isActive = config.id === activeWorkbenchConfigId;
          const isRenaming = config.id === renamingConfigId;
          const statusLabel = mapConfigStatusLabel(config.status, bundle);

          return (
            <Box
              key={config.id}
              component="div"
              role="button"
              tabIndex={0}
              onClick={() => switchWorkbenchConfig(config.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  switchWorkbenchConfig(config.id);
                }
              }}
              sx={{
                textAlign: 'left',
                p: 1.5,
                borderRadius: '18px',
                border: isActive
                  ? '1px solid rgba(24, 88, 163, 0.34)'
                  : '1px solid rgba(24, 51, 89, 0.12)',
                background: isActive
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(223,236,247,0.92))'
                  : 'rgba(255,255,255,0.88)',
                boxShadow: isActive
                  ? '0 2px 8px rgba(24, 88, 163, 0.12)'
                  : '0 1px 4px rgba(24, 51, 89, 0.06)',
                minWidth: 0,
                display: 'grid',
                gap: 1,
                scrollSnapAlign: 'start',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease',
                '&:hover': {
                  borderColor: 'rgba(24, 88, 163, 0.24)',
                  boxShadow: '0 2px 10px rgba(24, 51, 89, 0.10)',
                },
                '&:focus-visible': {
                  borderColor: 'rgba(24, 88, 163, 0.34)',
                  boxShadow: '0 0 0 3px rgba(24, 88, 163, 0.16)',
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0, display: 'grid', gap: 0.5 }}>
                  {isRenaming ? (
                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      <TextField
                        size="small"
                        autoFocus
                        value={renameDraft}
                        onClick={event => event.stopPropagation()}
                        onChange={event => setRenameDraft(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitRename();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                        placeholder={bundle.workbenchConfigs.renamePlaceholder}
                      />
                      <Box sx={{ display: 'flex', gap: 0.75 }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={event => {
                            event.stopPropagation();
                            commitRename();
                          }}
                          aria-label={bundle.workbenchConfigs.saveRenameButton}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={event => {
                            event.stopPropagation();
                            cancelRename();
                          }}
                          aria-label={bundle.workbenchConfigs.cancelRenameButton}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {config.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'rgba(24, 51, 89, 0.68)',
                          fontSize: 12,
                          lineHeight: 1.4,
                          minHeight: 34,
                        }}
                      >
                        {config.targetSummary}
                      </Typography>
                    </>
                  )}
                </Box>

                {!isRenaming ? (
                  <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={event => {
                        event.stopPropagation();
                        startRenaming(config.id, config.customName);
                      }}
                      aria-label={bundle.workbenchConfigs.renameButton}
                    >
                      <DriveFileRenameOutlineIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={event => {
                        event.stopPropagation();
                        deleteWorkbenchConfig(config.id);
                      }}
                      aria-label={bundle.workbenchConfigs.deleteButton}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : null}
              </Box>

              {!isRenaming ? (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.75,
                      alignItems: 'center',
                    }}
                  >
                    <Chip
                      label={statusLabel}
                      size="small"
                      color={mapConfigStatusColor(config.status)}
                      variant={isActive ? 'filled' : 'outlined'}
                    />
                    <Chip
                      label={bundle.enums.objective[config.objective]}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={bundle.enums.balancePolicy[config.balancePolicy]}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1.25,
                      color: 'rgba(24, 51, 89, 0.74)',
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {config.roundedBuildingCount !== null ? (
                      <span>{`${bundle.summary.buildingsLabel} ${config.roundedBuildingCount}`}</span>
                    ) : null}
                    {config.recipePlanCount !== null ? (
                      <span>{`${bundle.summary.recipesLabel} ${config.recipePlanCount}`}</span>
                    ) : null}
                    {config.powerLabel ? <span>{config.powerLabel}</span> : null}
                    {config.roundedBuildingCount === null &&
                    config.recipePlanCount === null &&
                    !config.powerLabel ? (
                      <span>{bundle.common.notSolvedYet}</span>
                    ) : null}
                  </Box>
                </>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </article>
  );
}
