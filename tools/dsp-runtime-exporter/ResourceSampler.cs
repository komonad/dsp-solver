using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BepInEx.Logging;
using BepInEx.Bootstrap;
using Newtonsoft.Json;

namespace DspCalc.RuntimeExporter;

internal static class ResourceSampler
{
    public static IEnumerator Sample(int[] seeds, string path, ManualLogSource logger)
    {
        Type gameDescType = ReflectionHelpers.FindLoadedType("GameDesc") ?? throw new InvalidOperationException("GameDesc is unavailable.");
        Type universeType = ReflectionHelpers.FindLoadedType("UniverseGen") ?? throw new InvalidOperationException("UniverseGen is unavailable.");
        Type gameType = ReflectionHelpers.FindLoadedType("DSPGame") ?? throw new InvalidOperationException("DSPGame is unavailable.");
        var descriptorField = gameType.GetField("GameDesc")!;
        object? originalDescriptor = descriptorField.GetValue(null);
        var samples = new List<object>();
        var renewableItemIds = new SortedSet<int>();
        try
        {
            foreach (int seed in seeds)
            {
                object desc = Activator.CreateInstance(gameDescType)!;
                gameDescType.GetMethod("SetForNewGame")!.Invoke(desc, new object[] { 20200403, seed, 64, 1, 1f });
                // Vein algorithms read the active descriptor for resource multipliers.
                descriptorField.SetValue(null, desc);
                object galaxy = universeType.GetMethod("CreateGalaxy")!.Invoke(null, new[] { desc })!;
                Array stars = (Array)ReflectionHelpers.GetMemberValue(galaxy, "stars")!;
                var amounts = new SortedDictionary<int, long>();
                int planets = 0;
                foreach (object star in stars)
                {
                    foreach (object planet in (Array)ReflectionHelpers.GetMemberValue(star, "planets")!)
                    {
                        int waterItem = ReflectionHelpers.GetInt(planet, "waterItemId") ?? 0;
                        if (waterItem > 0) renewableItemIds.Add(waterItem);
                        foreach (int gasItem in ReflectionHelpers.GetIntArray(planet, "gasItems")) renewableItemIds.Add(gasItem);
                        if (ReflectionHelpers.GetString(planet, "type") == "Gas") continue;
                        planet.GetType().GetMethod("RegenerateRawDataImmediately")!.Invoke(planet, null);
                        object raw = ReflectionHelpers.GetMemberValue(planet, "data")!;
                        Array veins = (Array)ReflectionHelpers.GetMemberValue(raw, "veinPool")!;
                        int cursor = ReflectionHelpers.GetInt(raw, "veinCursor") ?? 0;
                        for (int i = 1; i < cursor; i++)
                        {
                            object vein = veins.GetValue(i)!;
                            if (ReflectionHelpers.GetInt(vein, "id") != i || ReflectionHelpers.GetString(vein, "type") == "Oil") continue;
                            int itemId = ReflectionHelpers.GetInt(vein, "productId") ?? 0;
                            long amount = Convert.ToInt64(ReflectionHelpers.GetMemberValue(vein, "amount"));
                            if (itemId <= 0 || amount <= 0) continue;
                            amounts.TryGetValue(itemId, out long previous);
                            amounts[itemId] = checked(previous + amount);
                        }
                        planet.GetType().GetField("data")!.SetValue(planet, null);
                        planets++;
                        if (planets % 16 == 0) logger.LogInfo($"Resource sample seed={seed} planets={planets}");
                        yield return null;
                    }
                }
                samples.Add(new { seed, starCount = stars.Length, solidPlanetCount = planets, amounts });
                GC.Collect();
            }
        }
        finally { descriptorField.SetValue(null, originalDescriptor); }
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonConvert.SerializeObject(new {
            schemaVersion = 1, resourceMultiplier = 1, starCount = 64,
            renewableItemIds,
            gameVersion = ReflectionHelpers.GetStaticMemberValue(ReflectionHelpers.FindLoadedType("GameConfig")!, "gameVersion")?.ToString(),
            loadedMods = Chainloader.PluginInfos.Values.Select(plugin => new {
                guid = plugin.Metadata.GUID, name = plugin.Metadata.Name, version = plugin.Metadata.Version.ToString(),
            }).OrderBy(plugin => plugin.guid).ToArray(),
            exportedAtUtc = DateTime.UtcNow, samples,
        }, Formatting.Indented));
        logger.LogInfo($"Resource samples written to {path}");
    }
}
