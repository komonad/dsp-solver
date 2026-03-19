using System;
using System.Collections;
using System.IO;
using BepInEx;
using BepInEx.Configuration;
using Newtonsoft.Json;
using UnityEngine;

namespace DspCalc.RuntimeExporter;

[BepInPlugin(PluginGuid, PluginName, PluginVersion)]
public sealed class ExporterPlugin : BaseUnityPlugin
{
    public const string PluginGuid = "com.comonad.dspcalc.runtime-exporter";
    public const string PluginName = "DspCalc Runtime Exporter";
    public const string PluginVersion = "0.1.0";

    private ConfigEntry<KeyboardShortcut>? exportShortcut;
    private ConfigEntry<string>? outputDirectory;
    private ConfigEntry<string>? outputFileStem;
    private ConfigEntry<bool>? autoExportOnStartup;
    private ConfigEntry<string>? datasetName;
    private ConfigEntry<string>? datasetDescription;
    private ConfigEntry<string>? sourceProfile;
    private ConfigEntry<string>? modSummary;
    private ConfigEntry<string>? notes;
    private bool autoExportTriggered;
    private bool runtimeReadyLogged;

    private void Awake()
    {
        exportShortcut = Config.Bind(
            "General",
            "ExportShortcut",
            new KeyboardShortcut(KeyCode.F8),
            "Press this shortcut in the main menu or in-game to export the current runtime dataset.");
        outputDirectory = Config.Bind(
            "General",
            "OutputDirectory",
            Path.Combine(Paths.ConfigPath, "dspcalc-exporter"),
            "Directory used for exported dataset files.");
        outputFileStem = Config.Bind(
            "General",
            "OutputFileStem",
            "CurrentGame",
            "Base filename used for the exported dataset JSON.");
        autoExportOnStartup = Config.Bind(
            "General",
            "AutoExportOnStartup",
            false,
            "When enabled, export once after runtime proto data becomes available.");
        datasetName = Config.Bind(
            "Metadata",
            "DatasetName",
            "CurrentGame",
            "Human-readable dataset name written into the sidecar metadata file.");
        datasetDescription = Config.Bind(
            "Metadata",
            "DatasetDescription",
            string.Empty,
            "Short dataset description written into the sidecar metadata file.");
        sourceProfile = Config.Bind(
            "Metadata",
            "SourceProfile",
            GuessProfileName(),
            "r2modman/BepInEx profile name that produced this dataset.");
        modSummary = Config.Bind(
            "Metadata",
            "ModSummary",
            string.Empty,
            "Short summary of the active mod combination.");
        notes = Config.Bind(
            "Metadata",
            "Notes",
            string.Empty,
            "Additional notes written into the sidecar metadata file.");

        string shortcutLabel = exportShortcut?.Value.ToString() ?? "unset";
        string configuredDirectory = outputDirectory?.Value ?? Path.Combine(Paths.ConfigPath, "dspcalc-exporter");
        string configuredStem = outputFileStem?.Value ?? "CurrentGame";
        Logger.LogInfo(
            $"{PluginName} {PluginVersion} loaded. guid={PluginGuid} shortcut={shortcutLabel} " +
            $"outputDir={configuredDirectory} fileStem={configuredStem} autoExport={autoExportOnStartup?.Value}");
        RuntimeNotifier.TryNotifyInfo($"{PluginName} loaded. Press {shortcutLabel} to export.", Logger);
        StartCoroutine(AutoExportWhenReady());
    }

    private void Update()
    {
        if (exportShortcut != null && exportShortcut.Value.IsDown())
        {
            TryExport("hotkey");
        }
    }

    private IEnumerator AutoExportWhenReady()
    {
        while (!GameDataExporter.IsReady())
        {
            yield return null;
        }

        if (!runtimeReadyLogged)
        {
            runtimeReadyLogged = true;
            Logger.LogInfo("Runtime proto data is ready. Exporter can now read LDB.items and LDB.recipes.");
            RuntimeNotifier.TryNotifyInfo("DspCalc exporter is ready.", Logger);
        }

        yield return null;

        if (autoExportOnStartup?.Value == true && !autoExportTriggered)
        {
            autoExportTriggered = true;
            TryExport("startup");
        }
    }

    private void TryExport(string reason)
    {
        string baseDirectory = outputDirectory?.Value ?? Path.Combine(Paths.ConfigPath, "dspcalc-exporter");
        string configuredFileStem = outputFileStem?.Value ?? string.Empty;
        string fileStem = string.IsNullOrWhiteSpace(configuredFileStem) ? "CurrentGame" : configuredFileStem.Trim();
        string outputPath = Path.Combine(baseDirectory, $"{fileStem}.json");

        try
        {
            if (!GameDataExporter.IsReady())
            {
                const string notReadyMessage = "Runtime data is not ready yet. Try again after the game reaches the main menu.";
                Logger.LogWarning(notReadyMessage);
                RuntimeNotifier.TryNotifyWarning("Export failed: runtime data is not ready yet.", Logger);
                WriteStatusFile(
                    outputPath,
                    new ExportRunStatus
                    {
                        success = false,
                        reason = reason,
                        outputPath = outputPath,
                        timestampUtc = DateTime.UtcNow,
                        message = notReadyMessage,
                    });
                return;
            }

            ExportedDatasetInfo exportInfo = GameDataExporter.ExportToFile(outputPath, Logger);
            WriteMetadataFile(outputPath, exportInfo);
            WriteStatusFile(
                outputPath,
                new ExportRunStatus
                {
                    success = true,
                    reason = reason,
                    itemCount = exportInfo.ItemCount,
                    recipeCount = exportInfo.RecipeCount,
                    outputPath = exportInfo.OutputPath,
                    timestampUtc = DateTime.UtcNow,
                    message = $"Export completed ({reason}).",
                });
            Logger.LogInfo(
                $"Export completed ({reason}): {exportInfo.OutputPath} " +
                $"items={exportInfo.ItemCount} recipes={exportInfo.RecipeCount}");
            RuntimeNotifier.TryNotifyInfo(
                $"Export succeeded: {exportInfo.ItemCount} items, {exportInfo.RecipeCount} recipes.",
                Logger);
        }
        catch (Exception ex)
        {
            WriteStatusFile(
                outputPath,
                new ExportRunStatus
                {
                    success = false,
                    reason = reason,
                    itemCount = 0,
                    recipeCount = 0,
                    outputPath = outputPath,
                    timestampUtc = DateTime.UtcNow,
                    message = ex.Message,
                    exception = ex.ToString(),
                });
            Logger.LogError($"Export failed ({reason}): {ex}");
            RuntimeNotifier.TryNotifyError($"Export failed: {ex.Message}", Logger);
        }
    }

    private void WriteMetadataFile(string datasetPath, ExportedDatasetInfo exportInfo)
    {
        try
        {
            ExportDatasetMetadata metadata = new ExportDatasetMetadata
            {
                datasetName = NormalizeMetadataText(datasetName?.Value, Path.GetFileNameWithoutExtension(datasetPath)),
                datasetDescription = NormalizeMetadataText(datasetDescription?.Value, string.Empty),
                sourceProfile = NormalizeMetadataText(sourceProfile?.Value, GuessProfileName()),
                modSummary = NormalizeMetadataText(modSummary?.Value, string.Empty),
                notes = NormalizeMetadataText(notes?.Value, string.Empty),
                outputPath = exportInfo.OutputPath,
                itemCount = exportInfo.ItemCount,
                recipeCount = exportInfo.RecipeCount,
                exportedAtUtc = DateTime.UtcNow,
                exportedBy = PluginGuid,
                exporterVersion = PluginVersion,
            };

            string metadataPath = Path.Combine(
                Path.GetDirectoryName(datasetPath) ?? Paths.ConfigPath,
                $"{Path.GetFileNameWithoutExtension(datasetPath)}.metadata.json");
            string json = JsonConvert.SerializeObject(
                metadata,
                Formatting.Indented,
                new JsonSerializerSettings
                {
                    NullValueHandling = NullValueHandling.Ignore,
                });
            Directory.CreateDirectory(Path.GetDirectoryName(metadataPath) ?? Paths.ConfigPath);
            File.WriteAllText(metadataPath, json);
            Logger.LogInfo($"Export metadata written to {metadataPath}");
        }
        catch (Exception ex)
        {
            Logger.LogWarning($"Failed to write export metadata file: {ex.Message}");
        }
    }

    private void WriteStatusFile(string datasetPath, ExportRunStatus status)
    {
        try
        {
            string statusPath = Path.Combine(
                Path.GetDirectoryName(datasetPath) ?? Paths.ConfigPath,
                $"{Path.GetFileNameWithoutExtension(datasetPath)}.status.json");
            string json = JsonConvert.SerializeObject(
                status,
                Formatting.Indented,
                new JsonSerializerSettings
                {
                    NullValueHandling = NullValueHandling.Ignore,
                });
            Directory.CreateDirectory(Path.GetDirectoryName(statusPath) ?? Paths.ConfigPath);
            File.WriteAllText(statusPath, json);
            Logger.LogInfo($"Export status written to {statusPath}");
        }
        catch (Exception ex)
        {
            Logger.LogWarning($"Failed to write export status file: {ex.Message}");
        }
    }

    private static string GuessProfileName()
    {
        try
        {
            string configPath = Paths.ConfigPath ?? string.Empty;
            if (string.IsNullOrWhiteSpace(configPath))
            {
                return string.Empty;
            }

            string[] parts = configPath.Split(
                new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar },
                StringSplitOptions.RemoveEmptyEntries);
            int profileIndex = Array.FindIndex(parts, part => string.Equals(part, "profiles", StringComparison.OrdinalIgnoreCase));
            if (profileIndex >= 0 && profileIndex + 1 < parts.Length)
            {
                return parts[profileIndex + 1];
            }

            string? fallback = new DirectoryInfo(configPath).Parent?.Parent?.Parent?.Name;
            return fallback ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string NormalizeMetadataText(string? value, string fallback)
    {
        string normalized = (value ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
    }
}

internal sealed class ExportRunStatus
{
    public bool success { get; set; }
    public string reason { get; set; } = string.Empty;
    public int itemCount { get; set; }
    public int recipeCount { get; set; }
    public string outputPath { get; set; } = string.Empty;
    public DateTime timestampUtc { get; set; }
    public string message { get; set; } = string.Empty;
    public string? exception { get; set; }
}

internal sealed class ExportDatasetMetadata
{
    public string datasetName { get; set; } = string.Empty;
    public string datasetDescription { get; set; } = string.Empty;
    public string sourceProfile { get; set; } = string.Empty;
    public string modSummary { get; set; } = string.Empty;
    public string notes { get; set; } = string.Empty;
    public string outputPath { get; set; } = string.Empty;
    public int itemCount { get; set; }
    public int recipeCount { get; set; }
    public DateTime exportedAtUtc { get; set; }
    public string exportedBy { get; set; } = string.Empty;
    public string exporterVersion { get; set; } = string.Empty;
}
