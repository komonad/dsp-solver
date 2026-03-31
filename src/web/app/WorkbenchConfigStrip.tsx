import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import { Box, Button, Chip, IconButton, TextField, Tooltip, Typography } from '@mui/material';
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
    catalogLabel,
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
    <article style={{ ...cardStyle, display: 'grid', gap: 8, padding: 10 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.75,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {bundle.workbenchConfigs.title}
          </Typography>
          {catalogLabel ? (
            <Chip
              label={catalogLabel}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
            />
          ) : null}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={bundle.workbenchConfigs.createDefaultButton}>
            <Button
              size="small"
              onClick={createDefaultWorkbenchConfig}
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600, px: 1, py: 0, minWidth: 0, color: 'rgba(24, 51, 89, 0.7)' }}
            >
              {bundle.workbenchConfigs.createDefaultButtonShort}
            </Button>
          </Tooltip>
          <Tooltip title={bundle.workbenchConfigs.forkButton}>
            <span>
            <Button
              size="small"
              onClick={forkActiveWorkbenchConfig}
              disabled={!activeConfig}
              startIcon={<ForkRightIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600, px: 1, py: 0, minWidth: 0, color: 'rgba(24, 51, 89, 0.7)' }}
            >
              {bundle.workbenchConfigs.forkButtonShort}
            </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: {
            xs: 'minmax(200px, 80vw)',
            sm: 'minmax(200px, 240px)',
          },
          gap: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          pb: 0.25,
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
                p: 1,
                borderRadius: '12px',
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
                gap: 0.5,
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
                  gap: 0.5,
                }}
              >
                <Box sx={{ minWidth: 0, display: 'grid', gap: 0.25 }}>
                  {isRenaming ? (
                    <Box sx={{ display: 'grid', gap: 0.5 }}>
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
                        sx={{ '& .MuiInputBase-root': { fontSize: 12, height: 28 } }}
                      />
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={event => {
                            event.stopPropagation();
                            commitRename();
                          }}
                          aria-label={bundle.workbenchConfigs.saveRenameButton}
                          sx={{ width: 22, height: 22, p: 0 }}
                        >
                          <CheckIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={event => {
                            event.stopPropagation();
                            cancelRename();
                          }}
                          aria-label={bundle.workbenchConfigs.cancelRenameButton}
                          sx={{ width: 22, height: 22, p: 0 }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700,
                            fontSize: 12,
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}
                        >
                          {config.title}
                        </Typography>
                        {config.datasetLabel ? (
                          <Chip
                            label={config.datasetLabel}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 16,
                              fontSize: 10,
                              fontWeight: 600,
                              flexShrink: 0,
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        ) : null}
                      </Box>
                      {config.hasCustomName ? (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(24, 51, 89, 0.6)',
                            fontSize: 11,
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {config.targetSummary}
                        </Typography>
                      ) : null}
                    </>
                  )}
                </Box>

                {!isRenaming ? (
                  <Box sx={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={event => {
                        event.stopPropagation();
                        startRenaming(config.id, config.customName);
                      }}
                      aria-label={bundle.workbenchConfigs.renameButton}
                      sx={{ width: 22, height: 22, p: 0 }}
                    >
                      <DriveFileRenameOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={event => {
                        event.stopPropagation();
                        deleteWorkbenchConfig(config.id);
                      }}
                      aria-label={bundle.workbenchConfigs.deleteButton}
                      sx={{ width: 22, height: 22, p: 0 }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ) : null}
              </Box>

              {!isRenaming ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    alignItems: 'center',
                  }}
                >
                  <Chip
                    label={statusLabel}
                    size="small"
                    color={mapConfigStatusColor(config.status)}
                    variant={isActive ? 'filled' : 'outlined'}
                    sx={{ height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.75 } }}
                  />
                  {config.roundedBuildingCount !== null ? (
                    <Typography component="span" sx={{ fontSize: 11, color: 'rgba(24, 51, 89, 0.68)' }}>
                      {`${bundle.summary.buildingsLabel} ${config.roundedBuildingCount}`}
                    </Typography>
                  ) : null}
                  {config.recipePlanCount !== null ? (
                    <Typography component="span" sx={{ fontSize: 11, color: 'rgba(24, 51, 89, 0.68)' }}>
                      {`${bundle.summary.recipesLabel} ${config.recipePlanCount}`}
                    </Typography>
                  ) : null}
                  {config.powerLabel ? (
                    <Typography component="span" sx={{ fontSize: 11, color: 'rgba(24, 51, 89, 0.68)' }}>
                      {config.powerLabel}
                    </Typography>
                  ) : null}
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </article>
  );
}
