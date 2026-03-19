using System;
using System.Collections;
using System.IO;
using BepInEx;
using BepInEx.Configuration;
using UnityEngine;

namespace DspCalc.RuntimeExporter;

[BepInPlugin(PluginGuid, PluginName, PluginVersion)]
public sealed class ExporterPlugin : BaseUnityPlugin
{
    public const string PluginGuid = "com.dspcalc.runtime-exporter";
    public const string PluginName = "DspCalc Runtime Exporter";
    public const string PluginVersion = "0.1.0";

    private ConfigEntry<KeyboardShortcut>? exportShortcut;
    private ConfigEntry<string>? outputDirectory;
    private ConfigEntry<string>? outputFileStem;
    private ConfigEntry<bool>? autoExportOnStartup;
    private bool autoExportTriggered;

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

        Logger.LogInfo($"{PluginName} {PluginVersion} loaded.");
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
                Logger.LogWarning("Runtime data is not ready yet. Try again after the game reaches the main menu.");
                return;
            }

            string baseDirectory = outputDirectory?.Value ?? Path.Combine(Paths.ConfigPath, "dspcalc-exporter");
            string fileStem = string.IsNullOrWhiteSpace(outputFileStem?.Value) ? "CurrentGame" : outputFileStem.Value.Trim();
            string outputPath = Path.Combine(baseDirectory, $"{fileStem}.json");
            string writtenPath = GameDataExporter.ExportToFile(outputPath, Logger);
            Logger.LogInfo($"Export completed ({reason}): {writtenPath}");
        }
        catch (Exception ex)
        {
            Logger.LogError($"Export failed ({reason}): {ex}");
        }
    }
}
