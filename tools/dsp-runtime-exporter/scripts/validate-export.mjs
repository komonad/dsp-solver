#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(
    [
      "Usage:",
      "  node tools/dsp-runtime-exporter/scripts/validate-export.mjs <dataset-json> [--strict-missing]",
      "",
      "Default behavior:",
      "  - missing icon coverage is reported as warnings",
      "  - broken manifest/files/png headers are reported as errors",
    ].join("\n"),
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isPng(buffer) {
  if (buffer.length < 24) {
    return false;
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < pngSignature.length; index += 1) {
    if (buffer[index] !== pngSignature[index]) {
      return false;
    }
  }

  return buffer.toString("ascii", 12, 16) === "IHDR";
}

function readPngSize(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function main(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const strictMissing = argv.includes("--strict-missing");
  const datasetArg = argv.find((arg) => !arg.startsWith("--"));
  if (!datasetArg) {
    usage();
    process.exit(1);
  }

  const datasetPath = path.resolve(datasetArg);
  const datasetDir = path.dirname(datasetPath);
  const datasetStem = path.basename(datasetPath, path.extname(datasetPath));
  const manifestPath = path.join(datasetDir, `${datasetStem}.icons.manifest.json`);

  const errors = [];
  const warnings = [];

  if (!fs.existsSync(datasetPath)) {
    errors.push(`Dataset file does not exist: ${datasetPath}`);
  }

  if (!fs.existsSync(manifestPath)) {
    errors.push(`Icon manifest does not exist: ${manifestPath}`);
  }

  if (errors.length > 0) {
    console.log(JSON.stringify({ ok: false, errors, warnings }, null, 2));
    process.exit(1);
  }

  let dataset;
  let manifest;
  try {
    dataset = readJson(datasetPath);
  } catch (error) {
    errors.push(`Failed to parse dataset JSON: ${error.message}`);
  }

  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    errors.push(`Failed to parse icon manifest JSON: ${error.message}`);
  }

  if (errors.length > 0) {
    console.log(JSON.stringify({ ok: false, errors, warnings }, null, 2));
    process.exit(1);
  }

  const items = Array.isArray(dataset.items) ? dataset.items : [];
  const itemIcons = Array.isArray(manifest.itemIcons) ? manifest.itemIcons : [];

  const uniqueItemIconKeys = new Map();
  let itemsWithoutIconName = 0;
  for (const item of items) {
    const iconName = String(item.IconName ?? "").trim();
    if (!iconName) {
      itemsWithoutIconName += 1;
      continue;
    }

    if (!uniqueItemIconKeys.has(iconName)) {
      uniqueItemIconKeys.set(iconName, []);
    }

    uniqueItemIconKeys.get(iconName).push({
      ID: item.ID,
      Name: item.Name,
    });
  }

  const manifestKeys = new Set();
  for (const iconEntry of itemIcons) {
    const iconName = String(iconEntry.iconName ?? "").trim();
    if (!iconName) {
      errors.push(`Manifest entry is missing iconName: ${JSON.stringify(iconEntry)}`);
      continue;
    }

    if (manifestKeys.has(iconName)) {
      errors.push(`Manifest contains duplicate iconName: ${iconName}`);
    }
    manifestKeys.add(iconName);

    const relativePath = String(iconEntry.relativePath ?? "").trim();
    if (!relativePath) {
      errors.push(`Manifest entry ${iconName} is missing relativePath.`);
      continue;
    }

    const filePath = path.resolve(datasetDir, relativePath);
    if (!fs.existsSync(filePath)) {
      errors.push(`Manifest entry ${iconName} points to a missing file: ${filePath}`);
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    if (buffer.length === 0) {
      errors.push(`Icon file is empty: ${filePath}`);
      continue;
    }

    if (!isPng(buffer)) {
      errors.push(`Icon file is not a valid PNG: ${filePath}`);
      continue;
    }

    const { width, height } = readPngSize(buffer);
    if (width <= 0 || height <= 0) {
      errors.push(`Icon file has invalid dimensions ${width}x${height}: ${filePath}`);
    }
  }

  const missingKeys = [...uniqueItemIconKeys.keys()].filter((key) => !manifestKeys.has(key));
  const extraKeys = [...manifestKeys].filter((key) => !uniqueItemIconKeys.has(key));

  if (manifest.iconCount !== itemIcons.length) {
    errors.push(
      `Manifest iconCount (${manifest.iconCount}) does not match itemIcons length (${itemIcons.length}).`,
    );
  }

  if (itemsWithoutIconName > 0) {
    warnings.push(`Dataset contains ${itemsWithoutIconName} item(s) without IconName.`);
  }

  if (missingKeys.length > 0) {
    const message = `Missing ${missingKeys.length} exported icon key(s): ${missingKeys.slice(0, 20).join(", ")}`;
    if (strictMissing) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (extraKeys.length > 0) {
    warnings.push(`Manifest contains ${extraKeys.length} extra icon key(s): ${extraKeys.slice(0, 20).join(", ")}`);
  }

  const summary = {
    ok: errors.length === 0,
    strictMissing,
    datasetPath,
    manifestPath,
    itemCount: items.length,
    uniqueItemIconKeys: uniqueItemIconKeys.size,
    manifestIconCount: manifest.iconCount,
    itemsWithoutIconName,
    missingKeyCount: missingKeys.length,
    extraKeyCount: extraKeys.length,
    warnings,
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
}

main(process.argv.slice(2));
