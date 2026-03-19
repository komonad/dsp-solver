using System;
using System.Linq;
using System.Reflection;
using BepInEx.Logging;
using UnityEngine;

namespace DspCalc.RuntimeExporter;

internal static class RuntimeNotifier
{
    public static bool TryNotifyInfo(string message, ManualLogSource logger)
    {
        return TryNotify(message, logger);
    }

    public static bool TryNotifyWarning(string message, ManualLogSource logger)
    {
        return TryNotify(message, logger);
    }

    public static bool TryNotifyError(string message, ManualLogSource logger)
    {
        return TryNotify(message, logger);
    }

    private static bool TryNotify(string message, ManualLogSource logger)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        Type? realtimeTipType = ReflectionHelpers.FindLoadedType("UIRealtimeTip");
        if (realtimeTipType == null)
        {
            logger.LogDebug("UIRealtimeTip is not available yet; skipped in-game notification.");
            return false;
        }

        MethodInfo[] popupMethods = realtimeTipType
            .GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
            .Where(method => string.Equals(method.Name, "Popup", StringComparison.Ordinal))
            .OrderBy(method => method.GetParameters().Length)
            .ToArray();

        foreach (MethodInfo method in popupMethods)
        {
            ParameterInfo[] parameters = method.GetParameters();
            object?[]? arguments = TryBuildArguments(parameters, message);
            if (arguments == null)
            {
                continue;
            }

            try
            {
                method.Invoke(null, arguments);
                return true;
            }
            catch
            {
            }
        }

        logger.LogDebug("No compatible UIRealtimeTip.Popup overload accepted the notification message.");
        return false;
    }

    private static object?[]? TryBuildArguments(ParameterInfo[] parameters, string message)
    {
        if (parameters.Length == 0 || parameters[0].ParameterType != typeof(string))
        {
            return null;
        }

        object?[] arguments = new object?[parameters.Length];
        arguments[0] = message;

        for (int index = 1; index < parameters.Length; index++)
        {
            Type parameterType = parameters[index].ParameterType;

            if (parameterType == typeof(string))
            {
                arguments[index] = string.Empty;
            }
            else if (parameterType == typeof(int))
            {
                arguments[index] = 0;
            }
            else if (parameterType == typeof(float))
            {
                arguments[index] = 0f;
            }
            else if (parameterType == typeof(double))
            {
                arguments[index] = 0d;
            }
            else if (parameterType == typeof(bool))
            {
                arguments[index] = false;
            }
            else if (parameterType == typeof(Vector2))
            {
                arguments[index] = Vector2.zero;
            }
            else if (parameterType == typeof(Vector3))
            {
                arguments[index] = Vector3.zero;
            }
            else if (parameterType == typeof(Color))
            {
                arguments[index] = Color.white;
            }
            else if (parameterType.IsEnum)
            {
                Array values = Enum.GetValues(parameterType);
                arguments[index] = values.Length > 0 ? values.GetValue(0) : Activator.CreateInstance(parameterType);
            }
            else if (!parameterType.IsValueType)
            {
                arguments[index] = null;
            }
            else
            {
                try
                {
                    arguments[index] = Activator.CreateInstance(parameterType);
                }
                catch
                {
                    return null;
                }
            }
        }

        return arguments;
    }
}
