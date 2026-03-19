param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$DatasetJson,
  [switch]$StrictMissing,
  [string]$AtlasStem
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail($message) {
  Write-Error $message
  exit 1
}

Add-Type -AssemblyName System.Drawing

$datasetPath = [System.IO.Path]::GetFullPath($DatasetJson)
if (-not (Test-Path -LiteralPath $datasetPath)) {
  Fail "Dataset file does not exist: $datasetPath"
}

$datasetDir = Split-Path -Parent $datasetPath
$datasetBaseName = [System.IO.Path]::GetFileNameWithoutExtension($datasetPath)
$manifestPath = Join-Path $datasetDir ($datasetBaseName + '.icons.manifest.json')
if (-not (Test-Path -LiteralPath $manifestPath)) {
  Fail "Icon manifest does not exist: $manifestPath"
}

if ([string]::IsNullOrWhiteSpace($AtlasStem)) {
  $AtlasStem = $datasetBaseName + '.items.atlas'
}

$atlasJsonPath = Join-Path $datasetDir ($AtlasStem + '.json')
$atlasPngPath = Join-Path $datasetDir ($AtlasStem + '.png')

$manifestJson = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$entries = @($manifestJson.itemIcons)
if ($entries.Count -eq 0) {
  Fail "Icon manifest contains no itemIcons: $manifestPath"
}

$warnings = New-Object System.Collections.Generic.List[string]
$errors = New-Object System.Collections.Generic.List[string]
$iconRows = New-Object System.Collections.Generic.List[object]
$seenIconNames = @{}

foreach ($entry in $entries) {
  $iconName = [string]$entry.iconName
  if ($null -eq $iconName) {
    $iconName = ''
  }

  $relativePath = [string]$entry.relativePath
  if ($null -eq $relativePath) {
    $relativePath = ''
  }

  if ([string]::IsNullOrWhiteSpace($iconName)) {
    $errors.Add("Manifest entry is missing iconName: $($entry | ConvertTo-Json -Compress)")
    continue
  }

  if ($seenIconNames.ContainsKey($iconName)) {
    $errors.Add("Manifest contains duplicate iconName: $iconName")
    continue
  }
  $seenIconNames[$iconName] = $true

  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    $errors.Add("Manifest entry $iconName is missing relativePath.")
    continue
  }

  $sourcePath = [System.IO.Path]::GetFullPath((Join-Path $datasetDir $relativePath))
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    $message = "Missing icon file for ${iconName}: $sourcePath"
    if ($StrictMissing) {
      $errors.Add($message)
    } else {
      $warnings.Add($message)
    }
    continue
  }

  $bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    if ($bitmap.Width -le 0 -or $bitmap.Height -le 0) {
      $errors.Add("Icon file has invalid dimensions $($bitmap.Width)x$($bitmap.Height): $sourcePath")
      continue
    }

    $iconRows.Add([pscustomobject]@{
      iconName = $iconName
      sourcePath = $sourcePath
      width = $bitmap.Width
      height = $bitmap.Height
    })
  } finally {
    $bitmap.Dispose()
  }
}

if ($errors.Count -gt 0) {
  [pscustomobject]@{
    ok = $false
    datasetPath = $datasetPath
    manifestPath = $manifestPath
    atlasJsonPath = $atlasJsonPath
    atlasPngPath = $atlasPngPath
    warnings = @($warnings)
    errors = @($errors)
  } | ConvertTo-Json -Depth 8 | Write-Output
  exit 1
}

if ($iconRows.Count -eq 0) {
  Fail "No icon files remained after filtering manifest entries."
}

$sortedRows = @($iconRows | Sort-Object iconName)
$cellWidth = ($sortedRows | Measure-Object -Property width -Maximum).Maximum
$cellHeight = ($sortedRows | Measure-Object -Property height -Maximum).Maximum
$columns = [Math]::Ceiling([Math]::Sqrt($sortedRows.Count))
$rows = [Math]::Ceiling($sortedRows.Count / $columns)
$atlasWidth = [int]($columns * $cellWidth)
$atlasHeight = [int]($rows * $cellHeight)

$bitmap = New-Object System.Drawing.Bitmap($atlasWidth, $atlasHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

$atlasEntries = [ordered]@{}

try {
  for ($index = 0; $index -lt $sortedRows.Count; $index += 1) {
    $row = $sortedRows[$index]
    $column = $index % $columns
    $line = [Math]::Floor($index / $columns)
    $x = [int]($column * $cellWidth)
    $y = [int]($line * $cellHeight)

    $sourceBitmap = [System.Drawing.Bitmap]::FromFile($row.sourcePath)
    try {
      $graphics.DrawImageUnscaled($sourceBitmap, $x, $y)
    } finally {
      $sourceBitmap.Dispose()
    }

    $atlasEntries[$row.iconName] = [ordered]@{
      x = $x
      y = $y
      width = $row.width
      height = $row.height
      total_width = $atlasWidth
      total_height = $atlasHeight
    }
  }

  $bitmap.Save($atlasPngPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

$atlasJsonObject = [pscustomobject]$atlasEntries
$atlasJson = $atlasJsonObject | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($atlasJsonPath, $atlasJson, [System.Text.UTF8Encoding]::new($false))

[pscustomobject]@{
  ok = $true
  datasetPath = $datasetPath
  manifestPath = $manifestPath
  atlasJsonPath = $atlasJsonPath
  atlasPngPath = $atlasPngPath
  iconCount = $sortedRows.Count
  atlasWidth = $atlasWidth
  atlasHeight = $atlasHeight
  columns = $columns
  rows = $rows
  cellWidth = $cellWidth
  cellHeight = $cellHeight
  warnings = @($warnings)
  errors = @()
} | ConvertTo-Json -Depth 8 | Write-Output
