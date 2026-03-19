#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(
    [
      "Usage:",
      "  node tools/dsp-runtime-exporter/scripts/validate-atlas.mjs <dataset-json> [--strict-missing] [--atlas-stem <stem>]",
      "",
      "Default behavior:",
      "  - source icons missing from atlas are warnings",
      "  - missing atlas files, bad png/json, or invalid sprite geometry are errors",
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

function getArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
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

  const atlasStemOverride = getArgValue(argv, "--atlas-stem");
  const datasetPath = path.resolve(datasetArg);
  const datasetDir = path.dirname(datasetPath);
  const datasetStem = path.basename(datasetPath, path.extname(datasetPath));
  const atlasStem = atlasStemOverride?.trim() || `${datasetStem}.items.atlas`;
  const manifestPath = path.join(datasetDir, `${datasetStem}.icons.manifest.json`);
  const atlasJsonPath = path.join(datasetDir, `${atlasStem}.json`);
  const atlasPngPath = path.join(datasetDir, `${atlasStem}.png`);

  const warnings = [];
  const errors = [];

  if (!fs.existsSync(datasetPath)) {
    errors.push(`Dataset file does not exist: ${datasetPath}`);
  }
  if (!fs.existsSync(manifestPath)) {
    errors.push(`Icon manifest does not exist: ${manifestPath}`);
  }
  if (!fs.existsSync(atlasJsonPath)) {
    errors.push(`Atlas JSON does not exist: ${atlasJsonPath}`);
  }
  if (!fs.existsSync(atlasPngPath)) {
    errors.push(`Atlas PNG does not exist: ${atlasPngPath}`);
  }

  if (errors.length > 0) {
    console.log(JSON.stringify({ ok: false, warnings, errors }, null, 2));
    process.exit(1);
  }

  let dataset;
  let manifest;
  let atlas;
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
  try {
    atlas = readJson(atlasJsonPath);
  } catch (error) {
    errors.push(`Failed to parse atlas JSON: ${error.message}`);
  }

  const atlasBuffer = fs.readFileSync(atlasPngPath);
  if (!isPng(atlasBuffer)) {
    errors.push(`Atlas PNG is not a valid PNG: ${atlasPngPath}`);
  }
  const atlasSize = isPng(atlasBuffer) ? readPngSize(atlasBuffer) : { width: 0, height: 0 };

  if (errors.length > 0) {
    console.log(JSON.stringify({ ok: false, warnings, errors }, null, 2));
    process.exit(1);
  }

  const items = Array.isArray(dataset.items) ? dataset.items : [];
  const itemIcons = Array.isArray(manifest.itemIcons) ? manifest.itemIcons : [];

  const expectedKeys = new Map();
  for (const item of items) {
    const iconName = String(item.IconName ?? "").trim();
    if (!iconName) {
      continue;
    }
    if (!expectedKeys.has(iconName)) {
      expectedKeys.set(iconName, []);
    }
    expectedKeys.get(iconName).push({ id: item.ID, name: item.Name });
  }

  const manifestEntries = new Map();
  for (const entry of itemIcons) {
    const iconName = String(entry.iconName ?? "").trim();
    if (!iconName) {
      errors.push(`Manifest entry is missing iconName: ${JSON.stringify(entry)}`);
      continue;
    }
    if (manifestEntries.has(iconName)) {
      errors.push(`Manifest contains duplicate iconName: ${iconName}`);
      continue;
    }
    manifestEntries.set(iconName, entry);
  }

  const atlasKeys = new Set(Object.keys(atlas));
  const missingKeys = [...manifestEntries.keys()].filter((key) => !atlasKeys.has(key));
  if (missingKeys.length > 0) {
    const message = `Atlas is missing ${missingKeys.length} icon key(s): ${missingKeys.slice(0, 20).join(", ")}`;
    if (strictMissing) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  const extraKeys = [...atlasKeys].filter((key) => !manifestEntries.has(key));
  if (extraKeys.length > 0) {
    warnings.push(`Atlas contains ${extraKeys.length} extra icon key(s): ${extraKeys.slice(0, 20).join(", ")}`);
  }

  for (const [iconName, sprite] of Object.entries(atlas)) {
    const spriteFields = ["x", "y", "width", "height", "total_width", "total_height"];
    for (const field of spriteFields) {
      if (typeof sprite[field] !== "number" || !Number.isFinite(sprite[field])) {
        errors.push(`Atlas sprite ${iconName} is missing numeric field ${field}.`);
      }
    }
    if (errors.length > 0) {
      continue;
    }

    if (sprite.width <= 0 || sprite.height <= 0) {
      errors.push(`Atlas sprite ${iconName} has invalid size ${sprite.width}x${sprite.height}.`);
    }
    if (sprite.x < 0 || sprite.y < 0) {
      errors.push(`Atlas sprite ${iconName} has negative coordinates (${sprite.x}, ${sprite.y}).`);
    }
    if (sprite.x + sprite.width > atlasSize.width || sprite.y + sprite.height > atlasSize.height) {
      errors.push(
        `Atlas sprite ${iconName} overflows atlas bounds (${sprite.x}, ${sprite.y}, ${sprite.width}, ${sprite.height}) within ${atlasSize.width}x${atlasSize.height}.`,
      );
    }
    if (sprite.total_width !== atlasSize.width || sprite.total_height !== atlasSize.height) {
      errors.push(
        `Atlas sprite ${iconName} reports total size ${sprite.total_width}x${sprite.total_height}, expected ${atlasSize.width}x${atlasSize.height}.`,
      );
    }

    const manifestEntry = manifestEntries.get(iconName);
    if (!manifestEntry) {
      continue;
    }
    const sourcePath = path.resolve(datasetDir, String(manifestEntry.relativePath ?? ""));
    if (!fs.existsSync(sourcePath)) {
      const message = `Source icon file missing for ${iconName}: ${sourcePath}`;
      if (strictMissing) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
      continue;
    }

    const sourceBuffer = fs.readFileSync(sourcePath);
    if (!isPng(sourceBuffer)) {
      errors.push(`Source icon file is not a valid PNG: ${sourcePath}`);
      continue;
    }
    const sourceSize = readPngSize(sourceBuffer);
    if (sourceSize.width !== sprite.width || sourceSize.height !== sprite.height) {
      errors.push(
        `Atlas sprite ${iconName} size ${sprite.width}x${sprite.height} does not match source ${sourceSize.width}x${sourceSize.height}.`,
      );
    }
  }

  const summary = {
    ok: errors.length === 0,
    strictMissing,
    datasetPath,
    manifestPath,
    atlasJsonPath,
    atlasPngPath,
    itemCount: items.length,
    uniqueItemIconKeys: expectedKeys.size,
    manifestIconCount: manifestEntries.size,
    atlasIconCount: atlasKeys.size,
    atlasWidth: atlasSize.width,
    atlasHeight: atlasSize.height,
    missingKeyCount: missingKeys.length,
    extraKeyCount: extraKeys.length,
    warnings,
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
}

main(process.argv.slice(2));

