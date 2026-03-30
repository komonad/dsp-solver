import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

function getNpmInvocation() {
  const npmExecPath = process.env.npm_execpath;
  if (typeof npmExecPath === 'string' && npmExecPath.length > 0) {
    return {
      command: process.execPath,
      args: [npmExecPath],
    };
  }

  const bundledNpmCliPath = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (existsSync(bundledNpmCliPath)) {
    return {
      command: process.execPath,
      args: [bundledNpmCliPath],
    };
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: [],
  };
}

function pipeChildOutput(child, label) {
  child.stdout?.on('data', chunk => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr?.on('data', chunk => {
    process.stderr.write(`[${label}] ${chunk}`);
  });
}

const children = [];
let shuttingDown = false;

function terminateAll(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 1500).unref();
}

function spawnChild(command, args, label) {
  const child = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
  });

  children.push(child);
  pipeChildOutput(child, label);

  child.on('exit', code => {
    if (!shuttingDown) {
      terminateAll(code ?? 0);
    }
  });

  child.on('error', error => {
    process.stderr.write(`[${label}] ${error instanceof Error ? error.message : String(error)}\n`);
    terminateAll(1);
  });
}

const npmInvocation = getNpmInvocation();

spawnChild(npmInvocation.command, [...npmInvocation.args, 'run', 'watch:web'], 'watch:web');
spawnChild(process.execPath, ['scripts/host-web.mjs'], 'host');

process.on('SIGINT', () => terminateAll(0));
process.on('SIGTERM', () => terminateAll(0));
