using System;
using System.Collections.Generic;
using System.IO;
using BepInEx.Logging;
using Newtonsoft.Json;
using UnityEngine;

namespace DspCalc.RuntimeExporter;

internal static class ItemIconExporter
{
    public static ExportIconManifest ExportItemIcons(string datasetPath, ManualLogSource logger)
    {
        string iconsRoot = Path.Combine(
            Path.GetDirectoryName(datasetPath) ?? string.Empty,
            $"{Path.GetFileNameWithoutExtension(datasetPath)}.icons");
        string itemsDirectory = Path.Combine(iconsRoot, "items");
        string manifestPath = Path.Combine(
            Path.GetDirectoryName(datasetPath) ?? string.Empty,
            $"{Path.GetFileNameWithoutExtension(datasetPath)}.icons.manifest.json");

        if (Directory.Exists(itemsDirectory))
        {
            Directory.Delete(itemsDirectory, true);
        }

        Directory.CreateDirectory(itemsDirectory);

        Array itemsArray = GetItemProtoArray();
        HashSet<string> writtenIcons = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        ExportIconManifest manifest = new ExportIconManifest
        {
            datasetPath = datasetPath,
            itemsDirectory = itemsDirectory,
        };

        foreach (object? entry in itemsArray)
        {
            if (entry == null)
            {
                continue;
            }

            int? itemId = ReflectionHelpers.GetInt(entry, "ID");
            string itemName = ReflectionHelpers.GetString(entry, "Name") ?? string.Empty;
            string iconName = ResolveIconName(entry);
            if (!itemId.HasValue || string.IsNullOrWhiteSpace(iconName))
            {
                continue;
            }

            if (!writtenIcons.Add(iconName))
            {
                continue;
            }

            Sprite? sprite = ResolveSprite(entry);
            if (sprite == null)
            {
                logger.LogWarning($"Item {itemId.Value} ({itemName}) is missing iconSprite for icon key {iconName}.");
                continue;
            }

            byte[]? pngBytes = TryEncodeSprite(sprite, logger);
            if (pngBytes == null || pngBytes.Length == 0)
            {
                logger.LogWarning($"Failed to encode icon for item {itemId.Value} ({itemName}) with icon key {iconName}.");
                continue;
            }

            string filePath = Path.Combine(itemsDirectory, $"{iconName}.png");
            File.WriteAllBytes(filePath, pngBytes);
            manifest.itemIcons.Add(
                new ExportItemIconRecord
                {
                    itemId = itemId.Value,
                    itemName = itemName,
                    iconName = iconName,
                    relativePath = Path.Combine($"{Path.GetFileNameWithoutExtension(datasetPath)}.icons", "items", $"{iconName}.png"),
                });
        }

        manifest.iconCount = manifest.itemIcons.Count;

        string json = JsonConvert.SerializeObject(
            manifest,
            Formatting.Indented,
            new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore,
            });
        File.WriteAllText(manifestPath, json);
        logger.LogInfo($"Exported {manifest.iconCount} item icons to {itemsDirectory}");
        logger.LogInfo($"Icon manifest written to {manifestPath}");
        return manifest;
    }

    private static Array GetItemProtoArray()
    {
        Type? ldbType = ReflectionHelpers.FindLoadedType("LDB");
        if (ldbType == null)
        {
            throw new InvalidOperationException("LDB type is not loaded.");
        }

        object? protoSet = ReflectionHelpers.GetStaticMemberValue(ldbType, "items");
        if (protoSet == null)
        {
            throw new InvalidOperationException("LDB.items was not available.");
        }

        object? dataArray = ReflectionHelpers.GetMemberValue(protoSet, "dataArray");
        if (dataArray is not Array array)
        {
            throw new InvalidOperationException("LDB.items.dataArray was not available.");
        }

        return array;
    }

    private static string ResolveIconName(object proto)
    {
        foreach (string candidate in new[] { "IconName", "iconName", "iconPath", "IconPath" })
        {
            string? value = ReflectionHelpers.GetString(proto, candidate);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return NormalizeIconName(value!);
            }
        }

        Sprite? sprite = ResolveSprite(proto);
        if (sprite != null && !string.IsNullOrWhiteSpace(sprite.name))
        {
            return NormalizeIconName(sprite.name);
        }

        return string.Empty;
    }

    private static Sprite? ResolveSprite(object proto)
    {
        object? sprite = ReflectionHelpers.GetMemberValue(proto, "iconSprite")
            ?? ReflectionHelpers.GetMemberValue(proto, "IconSprite");
        return sprite as Sprite;
    }

    private static string NormalizeIconName(string raw)
    {
        string fileName = Path.GetFileNameWithoutExtension(raw.Replace('\\', Path.DirectorySeparatorChar));
        return string.IsNullOrWhiteSpace(fileName) ? raw : fileName;
    }

    private static byte[]? TryEncodeSprite(Sprite sprite, ManualLogSource logger)
    {
        Rect rect = sprite.rect;
        int width = Mathf.RoundToInt(rect.width);
        int height = Mathf.RoundToInt(rect.height);
        if (width <= 0 || height <= 0)
        {
            return null;
        }

        RenderTexture? renderTexture = null;
        RenderTexture? previousRenderTexture = RenderTexture.active;
        Texture2D? readableTexture = null;

        try
        {
            Texture texture = sprite.texture;
            renderTexture = RenderTexture.GetTemporary(texture.width, texture.height, 0, RenderTextureFormat.ARGB32);
            RenderTexture.active = renderTexture;
            GL.Clear(true, true, Color.clear);
            Graphics.Blit(texture, renderTexture);

            readableTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            Rect readRect = new Rect(rect.x, rect.y, rect.width, rect.height);
            readableTexture.ReadPixels(readRect, 0, 0);
            readableTexture.Apply();

            if (IsFullyTransparent(readableTexture))
            {
                Rect flippedReadRect = new Rect(rect.x, texture.height - rect.y - rect.height, rect.width, rect.height);
                readableTexture.ReadPixels(flippedReadRect, 0, 0);
                readableTexture.Apply();
            }

            if (IsFullyTransparent(readableTexture))
            {
                logger.LogWarning($"Sprite {sprite.name} exported as fully transparent after both crop attempts.");
            }

            return readableTexture.EncodeToPNG();
        }
        catch (Exception ex)
        {
            logger.LogWarning($"Failed to render sprite {sprite.name}: {ex.Message}");
            return null;
        }
        finally
        {
            if (readableTexture != null)
            {
                UnityEngine.Object.Destroy(readableTexture);
            }

            RenderTexture.active = previousRenderTexture;
            if (renderTexture != null)
            {
                RenderTexture.ReleaseTemporary(renderTexture);
            }
        }
    }

    private static bool IsFullyTransparent(Texture2D texture)
    {
        Color32[] pixels = texture.GetPixels32();
        for (int index = 0; index < pixels.Length; index++)
        {
            if (pixels[index].a != 0)
            {
                return false;
            }
        }

        return true;
    }
}
