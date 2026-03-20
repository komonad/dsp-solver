using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;

namespace DspCalc.RuntimeExporter;

internal static class ReflectionHelpers
{
    public static Type? FindLoadedType(string fullName)
    {
        foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
        {
            Type? type = assembly.GetType(fullName, false);
            if (type != null)
            {
                return type;
            }
        }

        return null;
    }

    public static object? GetStaticMemberValue(Type type, string memberName)
    {
        return GetMemberValue(type, null, memberName);
    }

    public static object? GetMemberValue(object target, string memberName)
    {
        return GetMemberValue(target.GetType(), target, memberName);
    }

    public static string? GetString(object target, string memberName)
    {
        object? value = GetMemberValue(target, memberName);
        return value?.ToString();
    }

    public static int? GetInt(object target, string memberName)
    {
        return ConvertToInt32(GetMemberValue(target, memberName));
    }

    public static double? GetDouble(object target, string memberName)
    {
        return ConvertToDouble(GetMemberValue(target, memberName));
    }

    public static int[] GetIntArray(object target, string memberName)
    {
        return ToArray<int>(GetMemberValue(target, memberName), ConvertToInt32);
    }

    public static double[] GetDoubleArray(object target, string memberName)
    {
        return ToArray<double>(GetMemberValue(target, memberName), ConvertToDouble);
    }

    public static bool? GetBool(object target, string memberName)
    {
        return ConvertToBoolean(GetMemberValue(target, memberName));
    }

    public static Dictionary<string, int> GetNamedIntMembers(
        object target,
        Func<string, bool> predicate)
    {
        const BindingFlags flags =
            BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static;

        Dictionary<string, int> values = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        Type type = target.GetType();

        foreach (PropertyInfo property in type.GetProperties(flags))
        {
            if (!predicate(property.Name))
            {
                continue;
            }

            int? value = ConvertToInt32(property.GetValue(target));
            if (value.HasValue)
            {
                values[property.Name] = value.Value;
            }
        }

        foreach (FieldInfo field in type.GetFields(flags))
        {
            if (!predicate(field.Name))
            {
                continue;
            }

            int? value = ConvertToInt32(field.GetValue(target));
            if (value.HasValue)
            {
                values[field.Name] = value.Value;
            }
        }

        return values;
    }

    public static bool TryTranslateInGame(string rawKey, out string translated)
    {
        translated = rawKey;
        if (string.IsNullOrWhiteSpace(rawKey))
        {
            return false;
        }

        Type? localizationType = FindLoadedType("Localization");
        MethodInfo? translateMethod = localizationType?
            .GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
            .FirstOrDefault(method =>
            {
                if (!string.Equals(method.Name, "Translate", StringComparison.Ordinal))
                {
                    return false;
                }

                ParameterInfo[] parameters = method.GetParameters();
                return parameters.Length == 1 && parameters[0].ParameterType == typeof(string);
            });

        if (translateMethod == null)
        {
            return false;
        }

        try
        {
            object? value = translateMethod.Invoke(null, new object[] { rawKey });
            if (value is string text && !string.IsNullOrWhiteSpace(text))
            {
                translated = text;
                return true;
            }
        }
        catch
        {
        }

        return false;
    }

    private static object? GetMemberValue(Type type, object? instance, string memberName)
    {
        const BindingFlags flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static;

        PropertyInfo? property = type.GetProperty(memberName, flags);
        if (property != null)
        {
            return property.GetValue(instance);
        }

        FieldInfo? field = type.GetField(memberName, flags);
        if (field != null)
        {
            return field.GetValue(instance);
        }

        PropertyInfo? insensitiveProperty = type.GetProperties(flags)
            .FirstOrDefault(entry => string.Equals(entry.Name, memberName, StringComparison.OrdinalIgnoreCase));
        if (insensitiveProperty != null)
        {
            return insensitiveProperty.GetValue(instance);
        }

        FieldInfo? insensitiveField = type.GetFields(flags)
            .FirstOrDefault(entry => string.Equals(entry.Name, memberName, StringComparison.OrdinalIgnoreCase));
        if (insensitiveField != null)
        {
            return insensitiveField.GetValue(instance);
        }

        return null;
    }

    private static int? ConvertToInt32(object? value)
    {
        if (value == null)
        {
            return null;
        }

        try
        {
            return Convert.ToInt32(value, CultureInfo.InvariantCulture);
        }
        catch
        {
            return null;
        }
    }

    private static double? ConvertToDouble(object? value)
    {
        if (value == null)
        {
            return null;
        }

        try
        {
            return Convert.ToDouble(value, CultureInfo.InvariantCulture);
        }
        catch
        {
            return null;
        }
    }

    private static bool? ConvertToBoolean(object? value)
    {
        if (value == null)
        {
            return null;
        }

        try
        {
            return Convert.ToBoolean(value, CultureInfo.InvariantCulture);
        }
        catch
        {
            return null;
        }
    }

    private static T[] ToArray<T>(object? value, Func<object?, T?> converter) where T : struct
    {
        if (value is string)
        {
            return new T[0];
        }

        if (value is not IEnumerable enumerable)
        {
            return new T[0];
        }

        List<T> result = new List<T>();
        foreach (object? item in enumerable)
        {
            T? converted = converter(item);
            if (converted.HasValue)
            {
                result.Add(converted.Value);
            }
        }

        return result.ToArray();
    }
}
