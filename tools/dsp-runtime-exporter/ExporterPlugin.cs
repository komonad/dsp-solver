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

        string shortcutLabel = exportShortcut?.Value.ToString() ?? "unset";
        string configuredDirectory = outputDirectory?.Value ?? Path.Combine(Paths.ConfigPath, "dspcalc-exporter");
        string configuredStem = outputFileStem?.Value ?? "CurrentGame";
        Logger.LogInfo($"{PluginName} {PluginVersion} loaded. guid={PluginGuid} shortcut={shortcutLabel} outputDir={configuredDirectory} fileStem={configuredStem} autoExport={autoExportOnStartup?.Value}");
        RuntimeNotifier.TryNotifyInfo($"{PluginName} 已加载，按 {shortcutLabel} 导出。", Logger);
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
            RuntimeNotifier.TryNotifyInfo("DspCalc 导出器已就绪。", Logger);
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
        try
        {
            if (!GameDataExporter.IsReady())
            {
                string notReadyMessage = "Runtime data is not ready yet. Try again after the game reaches the main menu.";
                Logger.LogWarning(notReadyMessage);
                RuntimeNotifier.TryNotifyWarning("导出失败：运行时数据尚未就绪。", Logger);
                return;
            }

            string baseDirectory = outputDirectory?.Value ?? Path.Combine(Paths.ConfigPath, "dspcalc-exporter");
            string configuredFileStem = outputFileStem?.Value ?? string.Empty;
            string fileStem = string.IsNullOrWhiteSpace(configuredFileStem) ? "CurrentGame" : configuredFileStem.Trim();
            string outputPath = Path.Combine(baseDirectory, $"{fileStem}.json");
            ExportedDatasetInfo exportInfo = GameDataExporter.ExportToFile(outputPath, Logger);
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
            Logger.LogInfo($"Export completed ({reason}): {exportInfo.OutputPath} items={exportInfo.ItemCount} recipes={exportInfo.RecipeCount}");
            RuntimeNotifier.TryNotifyInfo($"导出成功：{exportInfo.ItemCount} 物品，{exportInfo.RecipeCount} 配方。", Logger);
        }
        catch (Exception ex)
        {
            string baseDirectory = outputDirectory?.Value ?? Path.Combine(Paths.ConfigPath, "dspcalc-exporter");
            string configuredFileStem = outputFileStem?.Value ?? string.Empty;
            string fileStem = string.IsNullOrWhiteSpace(configuredFileStem) ? "CurrentGame" : configuredFileStem.Trim();
            string outputPath = Path.Combine(baseDirectory, $"{fileStem}.json");
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
            RuntimeNotifier.TryNotifyError($"导出失败：{ex.Message}", Logger);
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
