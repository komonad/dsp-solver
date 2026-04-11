#!/usr/bin/env node
/**
 * One-command dataset sync: build mod → configure → launch game → wait for export → build atlas → deploy to data/.
 *
 * Usage:
 *   node tools/dsp-runtime-exporter/scripts/sync-dataset.mjs --profile orbitalring --name OrbitalRing
 */

import { execSync, exec } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EXPORTER_ROOT = resolve(__dirname, '..');
const PROJECT_ROOT = resolve(EXPORTER_ROOT, '../..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { profile: '', name: '', skipBuild: false, skipAtlas: false, timeout: 300 };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--profile': opts.profile = args[++i] ?? ''; break;
      case '--name': opts.name = args[++i] ?? ''; break;
      case '--skip-build': opts.skipBuild = true; break;
      case '--skip-atlas': opts.skipAtlas = true; break;
      case '--timeout': opts.timeout = Number(args[++i]) || 300; break;
      default:
        fatal(`Unknown argument: ${args[i]}`);
    }
  }
  if (!opts.profile) fatal('--profile <name> is required');
  if (!opts.name) fatal('--name <DatasetName> is required');
  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(stage, msg) {
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] [${stage}] ${msg}`);
}

function fatal(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function run(cmd, opts = {}) {
  log('exec', cmd);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function isProcessRunning(processName) {
  try {
    const out = execSync(`tasklist /FI "IMAGENAME eq ${processName}" /NH`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return out.includes(processName);
  } catch {
    return false;
  }
}

function killProcess(processName) {
  try {
    execSync(`taskkill /F /IM ${processName}`, { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Local.props parsing
// ---------------------------------------------------------------------------

function parseLocalProps() {
  const propsPath = join(EXPORTER_ROOT, 'Local.props');
  if (!existsSync(propsPath)) {
    fatal(`Local.props not found at ${propsPath}. Copy Local.props.example and fill in paths.`);
  }
  const xml = readFileSync(propsPath, 'utf8');
  const get = (tag) => {
    const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return m?.[1]?.trim() ?? '';
  };
  return {
    dspManagedPath: get('DSPManagedPath'),
    bepInExDllPath: get('BepInExDllPath'),
  };
}

function deriveGameDir(dspManagedPath) {
  // DSPManagedPath = .../Dyson Sphere Program/DSPGAME_Data/Managed/
  return resolve(dspManagedPath, '..', '..');
}

function deriveProfilesDir(bepInExDllPath) {
  // BepInExDllPath = .../profiles/<name>/BepInEx/core/BepInEx.dll
  return resolve(bepInExDllPath, '..', '..', '..', '..');
}

// ---------------------------------------------------------------------------
// BepInEx config manipulation
// ---------------------------------------------------------------------------

function readBepInExConfig(configPath) {
  if (!existsSync(configPath)) return '';
  return readFileSync(configPath, 'utf8');
}

function setBepInExConfigValue(content, key, value) {
  const regex = new RegExp(`^(${key}\\s*=\\s*).*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `$1${value}`);
  }
  // If key doesn't exist, append under [General]
  if (/\[General\]/i.test(content)) {
    return content.replace(/(\[General\][^\[]*)/s, `$1${key} = ${value}\n`);
  }
  // No [General] section at all (e.g. new/empty config) — create one
  return `${content}[General]\n${key} = ${value}\n`;
}

function writeBepInExConfig(configPath, content) {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, content, 'utf8');
}

// ---------------------------------------------------------------------------
// BepInEx deployment to game directory
// ---------------------------------------------------------------------------

const BEPINEX_SUBDIRS = ['core', 'plugins', 'config', 'patchers'];

function deployBepInExToGameDir(profileBepInExDir, gameBepInExDir) {
  log('deploy', `Copying BepInEx from profile to game directory`);
  for (const sub of BEPINEX_SUBDIRS) {
    const src = join(profileBepInExDir, sub);
    const dst = join(gameBepInExDir, sub);
    if (existsSync(src)) {
      cpSync(src, dst, { recursive: true, force: true });
      log('deploy', `  ${sub}/ copied`);
    }
  }
}

function cleanBepInExFromGameDir(gameBepInExDir) {
  log('cleanup', `Removing deployed BepInEx subdirs from game directory`);
  for (const sub of BEPINEX_SUBDIRS) {
    const dst = join(gameBepInExDir, sub);
    if (existsSync(dst)) {
      rmSync(dst, { recursive: true, force: true });
      log('cleanup', `  ${sub}/ removed`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  log('init', `profile=${opts.profile} name=${opts.name} timeout=${opts.timeout}s`);

  // Stage 1: Parse paths
  const props = parseLocalProps();
  const gameDir = deriveGameDir(props.dspManagedPath);
  const gameExe = join(gameDir, 'DSPGAME.exe');
  const profilesDir = deriveProfilesDir(props.bepInExDllPath);
  const profileDir = join(profilesDir, opts.profile);
  const profileBepInExDir = join(profileDir, 'BepInEx');
  const gameBepInExDir = join(gameDir, 'BepInEx');

  if (!existsSync(gameExe)) fatal(`Game exe not found: ${gameExe}`);
  if (!existsSync(profileDir)) fatal(`Profile not found: ${profileDir}`);
  if (!existsSync(profileBepInExDir)) fatal(`Profile BepInEx not found: ${profileBepInExDir}`);

  log('paths', `gameDir = ${gameDir}`);
  log('paths', `profileDir = ${profileDir}`);

  const exporterConfigPath = join(profileBepInExDir, 'config', 'com.comonad.dspcalc.runtime-exporter.cfg');
  const exportOutputDir = join(profileBepInExDir, 'config', 'dspcalc-exporter');
  const exportDatasetPath = join(exportOutputDir, 'CurrentGame.json');
  const exportStatusPath = join(exportOutputDir, 'CurrentGame.status.json');

  // Stage 2: Build & deploy mod
  if (!opts.skipBuild) {
    log('build', 'Building exporter mod...');
    const csproj = join(EXPORTER_ROOT, 'DspCalc.RuntimeExporter.csproj');
    run(`dotnet build "${csproj}" -c Release`);

    const builtDll = join(EXPORTER_ROOT, 'bin', 'Release', 'DspCalc.RuntimeExporter.dll');
    const pluginDir = join(profileBepInExDir, 'plugins', 'DspCalc.RuntimeExporter');
    mkdirSync(pluginDir, { recursive: true });
    copyFileSync(builtDll, join(pluginDir, 'DspCalc.RuntimeExporter.dll'));

    // Also copy Newtonsoft.Json.dll if present
    const newtonsoftSrc = join(EXPORTER_ROOT, 'bin', 'Release', 'Newtonsoft.Json.dll');
    if (existsSync(newtonsoftSrc)) {
      copyFileSync(newtonsoftSrc, join(pluginDir, 'Newtonsoft.Json.dll'));
    }
    log('build', `Deployed to ${pluginDir}`);
  }

  // Stage 3: Configure mod
  log('config', 'Enabling AutoExportOnStartup and AutoQuitAfterExport...');
  let configContent = readBepInExConfig(exporterConfigPath);
  const configBackup = configContent;
  configContent = setBepInExConfigValue(configContent, 'OutputDirectory', exportOutputDir);
  configContent = setBepInExConfigValue(configContent, 'AutoExportOnStartup', 'true');
  configContent = setBepInExConfigValue(configContent, 'AutoQuitAfterExport', 'true');
  writeBepInExConfig(exporterConfigPath, configContent);

  // Stage 4: Clear old status file
  if (existsSync(exportStatusPath)) {
    unlinkSync(exportStatusPath);
    log('config', 'Cleared old status file');
  }

  // Stage 5: Deploy BepInEx to game dir & launch
  deployBepInExToGameDir(profileBepInExDir, gameBepInExDir);

  log('launch', 'Starting game via Steam...');
  exec('start steam://rungameid/1366540', { shell: true });

  // Stage 6: Wait for export
  log('wait', `Polling for export status (timeout ${opts.timeout}s)...`);
  const deadline = Date.now() + opts.timeout * 1000;
  let exportSucceeded = false;
  let exportedIconCount = 0;

  while (Date.now() < deadline) {
    await sleep(3000);

    if (existsSync(exportStatusPath)) {
      try {
        const status = JSON.parse(readFileSync(exportStatusPath, 'utf8'));
        if (status.success) {
          log('wait', `Export succeeded: ${status.itemCount} items, ${status.recipeCount} recipes, ${status.itemIconCount} icons`);
          exportSucceeded = true;
          exportedIconCount = status.itemIconCount ?? 0;
          break;
        } else if (status.message) {
          log('wait', `Export status: ${status.message}`);
        }
      } catch {
        // Status file might be partially written
      }
    }

    const gameRunning = isProcessRunning('DSPGAME.exe');
    if (!gameRunning && !existsSync(exportStatusPath)) {
      fatal('Game exited before producing a status file. Check BepInEx logs for errors.');
    }
  }

  if (!exportSucceeded) {
    fatal(`Export timed out after ${opts.timeout}s. Check if the game started correctly.`);
  }

  // Stage 7: Wait for game exit
  log('wait', 'Waiting for game to exit...');
  const quitDeadline = Date.now() + 30_000;
  while (isProcessRunning('DSPGAME.exe')) {
    if (Date.now() > quitDeadline) {
      log('wait', 'Game did not exit in time, killing process...');
      killProcess('DSPGAME.exe');
      await sleep(2000);
      break;
    }
    await sleep(2000);
  }
  log('wait', 'Game has exited');

  // Stage 8: Save BepInEx log then clean game directory
  const gameLogPath = join(gameBepInExDir, 'LogOutput.log');
  if (existsSync(gameLogPath)) {
    const savedLogPath = join(exportOutputDir, 'LastRun.log');
    copyFileSync(gameLogPath, savedLogPath);
    log('cleanup', `Saved BepInEx log → ${savedLogPath}`);
  }
  cleanBepInExFromGameDir(gameBepInExDir);

  // Stage 9: Post-processing
  log('post', 'Validating export...');
  try {
    run(`node "${join(EXPORTER_ROOT, 'scripts', 'validate-export.mjs')}" "${exportDatasetPath}"`);
  } catch (e) {
    log('post', `Warning: export validation reported issues (continuing anyway)`);
  }

  const dataDir = join(PROJECT_ROOT, 'data');
  const iconsDir = join(dataDir, 'icons');
  mkdirSync(iconsDir, { recursive: true });

  const skipAtlas = opts.skipAtlas || exportedIconCount === 0;
  if (exportedIconCount === 0 && !opts.skipAtlas) {
    log('post', 'No icons were exported (sprites not loaded at auto-export time). Skipping atlas build; existing atlas files will be kept.');
  }

  if (!skipAtlas) {
    log('post', 'Building icon atlas...');
    run(`powershell -ExecutionPolicy Bypass -File "${join(EXPORTER_ROOT, 'scripts', 'build-atlas.ps1')}" "${exportDatasetPath}"`);

    const atlasJsonSrc = join(exportOutputDir, 'CurrentGame.items.atlas.json');
    const atlasPngSrc = join(exportOutputDir, 'CurrentGame.items.atlas.png');

    if (!existsSync(atlasJsonSrc) || !existsSync(atlasPngSrc)) {
      fatal(`Atlas build did not produce expected output files in ${exportOutputDir}`);
    }

    log('post', `Copying atlas → data/icons/${opts.name}.json + .png`);
    copyFileSync(atlasJsonSrc, join(iconsDir, `${opts.name}.json`));
    copyFileSync(atlasPngSrc, join(iconsDir, `${opts.name}.png`));

    log('post', 'Validating atlas...');
    try {
      run(`node "${join(EXPORTER_ROOT, 'scripts', 'validate-atlas.mjs')}" "${exportDatasetPath}"`);
    } catch (e) {
      log('post', `Warning: atlas validation reported issues`);
    }
  }

  log('post', `Copying dataset → data/${opts.name}.json`);
  copyFileSync(exportDatasetPath, join(dataDir, `${opts.name}.json`));

  // Stage 10: Restore config
  log('config', 'Restoring mod config...');
  writeBepInExConfig(exporterConfigPath, configBackup);

  log('done', `Dataset "${opts.name}" synced successfully.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
