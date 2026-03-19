using System.Collections.Generic;

namespace DspCalc.RuntimeExporter;

internal sealed class ExportDataset
{
    public List<ExportItemRecord> items { get; set; } = new List<ExportItemRecord>();
    public List<ExportRecipeRecord> recipes { get; set; } = new List<ExportRecipeRecord>();
}

internal sealed class ExportItemRecord
{
    public int ID { get; set; }
    public int Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;
    public int? GridIndex { get; set; }
    public double? WorkEnergyPerTick { get; set; }
    public double? Speed { get; set; }
    public double? Space { get; set; }
    public double? MultipleOutput { get; set; }
}

internal sealed class ExportRecipeRecord
{
    public int ID { get; set; }
    public int Type { get; set; }
    public int[] Factories { get; set; } = new int[0];
    public string Name { get; set; } = string.Empty;
    public int[] Items { get; set; } = new int[0];
    public double[] ItemCounts { get; set; } = new double[0];
    public int[] Results { get; set; } = new int[0];
    public double[] ResultCounts { get; set; } = new double[0];
    public double TimeSpend { get; set; }
    public int Proliferator { get; set; }
    public string IconName { get; set; } = string.Empty;
}

internal sealed class ExportIconManifest
{
    public string datasetPath { get; set; } = string.Empty;
    public string itemsDirectory { get; set; } = string.Empty;
    public int iconCount { get; set; }
    public List<ExportItemIconRecord> itemIcons { get; set; } = new List<ExportItemIconRecord>();
}

internal sealed class ExportItemIconRecord
{
    public int itemId { get; set; }
    public string itemName { get; set; } = string.Empty;
    public string iconName { get; set; } = string.Empty;
    public string relativePath { get; set; } = string.Empty;
}
