using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BepInEx.Logging;
using Newtonsoft.Json;

namespace DspCalc.RuntimeExporter;

internal static class GameDataExporter
{
    public static bool IsReady()
    {
        Array? items = TryGetProtoArray("items");
        Array? recipes = TryGetProtoArray("recipes");
        return items != null && items.Length > 0 && recipes != null && recipes.Length > 0;
    }

    public static string ExportToFile(string outputPath, ManualLogSource logger)
    {
        ExportDataset dataset = BuildDataset(logger);
        string? directory = Path.GetDirectoryName(outputPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        string json = JsonConvert.SerializeObject(
            dataset,
            Formatting.Indented,
            new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore,
            });
        File.WriteAllText(outputPath, json);
        return outputPath;
    }

    private static ExportDataset BuildDataset(ManualLogSource logger)
    {
        Array itemsArray = TryGetProtoArray("items")
            ?? throw new InvalidOperationException("LDB.items.dataArray was not available.");
        Array recipesArray = TryGetProtoArray("recipes")
            ?? throw new InvalidOperationException("LDB.recipes.dataArray was not available.");

        List<ExportItemRecord> items = new List<ExportItemRecord>();
        foreach (object? entry in itemsArray)
        {
            if (entry == null)
            {
                continue;
            }

            ExportItemRecord? item = TryBuildItem(entry, logger);
            if (item != null)
            {
                items.Add(item);
            }
        }

        List<ExportRecipeRecord> recipes = new List<ExportRecipeRecord>();
        foreach (object? entry in recipesArray)
        {
            if (entry == null)
            {
                continue;
            }

            ExportRecipeRecord? recipe = TryBuildRecipe(entry, logger);
            if (recipe != null)
            {
                recipes.Add(recipe);
            }
        }

        return new ExportDataset
        {
            items = items.OrderBy(item => item.ID).ToList(),
            recipes = recipes.OrderBy(recipe => recipe.ID).ToList(),
        };
    }

    private static ExportItemRecord? TryBuildItem(object proto, ManualLogSource logger)
    {
        int? id = ReflectionHelpers.GetInt(proto, "ID");
        if (!id.HasValue)
        {
            return null;
        }

        int? type = ReflectionHelpers.GetInt(proto, "Type");
        string translatedName = ResolveTranslatedName(proto);
        string iconName = ResolveIconName(proto) ?? string.Empty;

        if (!type.HasValue)
        {
            logger.LogWarning($"Item {id.Value} is missing Type and will be skipped.");
            return null;
        }

        return new ExportItemRecord
        {
            ID = id.Value,
            Type = type.Value,
            Name = translatedName,
            IconName = iconName,
            GridIndex = ReflectionHelpers.GetInt(proto, "GridIndex"),
            WorkEnergyPerTick = ResolveNestedWorkEnergy(proto),
            Speed = ReflectionHelpers.GetDouble(proto, "Speed")
                ?? ResolveNestedSpeed(proto),
            Space = ReflectionHelpers.GetDouble(proto, "Space"),
            MultipleOutput = ReflectionHelpers.GetDouble(proto, "MultipleOutput"),
        };
    }

    private static ExportRecipeRecord? TryBuildRecipe(object proto, ManualLogSource logger)
    {
        int? id = ReflectionHelpers.GetInt(proto, "ID");
        if (!id.HasValue)
        {
            return null;
        }

        int? type = ReflectionHelpers.GetInt(proto, "Type");
        if (!type.HasValue)
        {
            logger.LogWarning($"Recipe {id.Value} is missing Type and will be skipped.");
            return null;
        }

        return new ExportRecipeRecord
        {
            ID = id.Value,
            Type = type.Value,
            Factories = ReflectionHelpers.GetIntArray(proto, "Factories"),
            Name = ResolveTranslatedName(proto),
            Items = ReflectionHelpers.GetIntArray(proto, "Items"),
            ItemCounts = ReflectionHelpers.GetDoubleArray(proto, "ItemCounts"),
            Results = ReflectionHelpers.GetIntArray(proto, "Results"),
            ResultCounts = ReflectionHelpers.GetDoubleArray(proto, "ResultCounts"),
            TimeSpend = ReflectionHelpers.GetDouble(proto, "TimeSpend") ?? 0,
            Proliferator = ReflectionHelpers.GetInt(proto, "Proliferator") ?? 0,
            IconName = ResolveIconName(proto) ?? string.Empty,
        };
    }

    private static Array? TryGetProtoArray(string ldbMemberName)
    {
        Type? ldbType = ReflectionHelpers.FindLoadedType("LDB");
        if (ldbType == null)
        {
            return null;
        }

        object? protoSet = ReflectionHelpers.GetStaticMemberValue(ldbType, ldbMemberName);
        if (protoSet == null)
        {
            return null;
        }

        object? dataArray = ReflectionHelpers.GetMemberValue(protoSet, "dataArray");
        return dataArray as Array;
    }

    private static string ResolveTranslatedName(object proto)
    {
        string rawName = ReflectionHelpers.GetString(proto, "Name") ?? string.Empty;
        if (ReflectionHelpers.TryTranslateInGame(rawName, out string translated))
        {
            return translated;
        }

        return rawName;
    }

    private static string? ResolveIconName(object proto)
    {
        foreach (string candidate in new[] { "IconName", "iconName", "iconPath", "IconPath" })
        {
            string? value = ReflectionHelpers.GetString(proto, candidate);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return NormalizeIconName(value);
            }
        }

        object? sprite = ReflectionHelpers.GetMemberValue(proto, "iconSprite")
            ?? ReflectionHelpers.GetMemberValue(proto, "IconSprite");
        if (sprite != null)
        {
            string? spriteName = ReflectionHelpers.GetString(sprite, "name");
            if (!string.IsNullOrWhiteSpace(spriteName))
            {
                return NormalizeIconName(spriteName);
            }
        }

        return null;
    }

    private static string NormalizeIconName(string raw)
    {
        string fileName = Path.GetFileNameWithoutExtension(raw.Replace('\\', Path.DirectorySeparatorChar));
        return string.IsNullOrWhiteSpace(fileName) ? raw : fileName;
    }

    private static double? ResolveNestedSpeed(object proto)
    {
        object? prefabDesc = ReflectionHelpers.GetMemberValue(proto, "prefabDesc");
        if (prefabDesc == null)
        {
            return null;
        }

        foreach (string candidate in new[]
        {
            "speed",
            "assemblerSpeed",
            "labAssembleSpeed",
            "fractionatorSpeed",
            "chemicalSpeed",
            "workSpeed"
        })
        {
            double? value = ReflectionHelpers.GetDouble(prefabDesc, candidate);
            if (value.HasValue && value.Value > 0)
            {
                return value;
            }
        }

        return null;
    }

    private static double? ResolveNestedWorkEnergy(object proto)
    {
        double? direct = ReflectionHelpers.GetDouble(proto, "WorkEnergyPerTick");
        if (direct.HasValue)
        {
            return direct;
        }

        object? prefabDesc = ReflectionHelpers.GetMemberValue(proto, "prefabDesc");
        if (prefabDesc == null)
        {
            return null;
        }

        return ReflectionHelpers.GetDouble(prefabDesc, "workEnergyPerTick")
            ?? ReflectionHelpers.GetDouble(prefabDesc, "WorkEnergyPerTick");
    }
}
