import React, { useMemo } from 'react';
import {
  getIconFallbackColor,
  getIconFallbackText,
  getResolvedIconSprite,
} from './iconRegistry';

export interface EntityIconProps {
  label: string;
  iconKey?: string;
  atlasIds?: string[];
  size?: number;
}

export interface EntityLabelProps extends EntityIconProps {
  textStyle?: React.CSSProperties;
  gap?: number;
}

export interface EntityLabelButtonProps extends EntityLabelProps {
  onClick: () => void;
  buttonStyle?: React.CSSProperties;
}

function areStringArraysEqual(left?: string[], right?: string[]): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function areFlatStyleObjectsEqual(
  left?: React.CSSProperties,
  right?: React.CSSProperties
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const key of leftKeys) {
    if (left[key as keyof React.CSSProperties] !== right[key as keyof React.CSSProperties]) {
      return false;
    }
  }
  return true;
}

function EntityIconImpl(props: EntityIconProps) {
  const { label, iconKey, atlasIds, size = 22 } = props;
  const resolvedIcon = useMemo(
    () => getResolvedIconSprite(iconKey, atlasIds),
    [iconKey, atlasIds]
  );
  const sprite = resolvedIcon?.sprite;
  const atlasSrc = resolvedIcon?.src;

  if (sprite && atlasSrc) {
    const scale = size / sprite.width;
    return (
      <span
        aria-hidden="true"
        title={label}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          backgroundImage: `url(${atlasSrc})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${sprite.total_width * scale}px ${sprite.total_height * scale}px`,
          backgroundPosition: `${-sprite.x * scale}px ${-sprite.y * scale}px`,
          flex: '0 0 auto',
          boxShadow: 'inset 0 0 0 1px rgba(24, 51, 89, 0.08)',
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: getIconFallbackColor(label),
        color: '#183359',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, Math.round(size * 0.45)),
        fontWeight: 700,
        lineHeight: 1,
        flex: '0 0 auto',
        boxShadow: 'inset 0 0 0 1px rgba(24, 51, 89, 0.12)',
      }}
    >
      {getIconFallbackText(label)}
    </span>
  );
}

export const EntityIcon = React.memo(
  EntityIconImpl,
  (left, right) =>
    left.label === right.label &&
    left.iconKey === right.iconKey &&
    left.size === right.size &&
    areStringArraysEqual(left.atlasIds, right.atlasIds)
);

function EntityLabelImpl(props: EntityLabelProps) {
  const { label, iconKey, atlasIds, size = 22, gap = 8, textStyle } = props;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        minWidth: 0,
        maxWidth: '100%',
      }}
      title={label}
    >
      <EntityIcon label={label} iconKey={iconKey} atlasIds={atlasIds} size={size} />
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...textStyle,
        }}
      >
        {label}
      </span>
    </span>
  );
}

export const EntityLabel = React.memo(
  EntityLabelImpl,
  (left, right) =>
    left.label === right.label &&
    left.iconKey === right.iconKey &&
    left.size === right.size &&
    left.gap === right.gap &&
    areStringArraysEqual(left.atlasIds, right.atlasIds) &&
    areFlatStyleObjectsEqual(left.textStyle, right.textStyle)
);

function EntityLabelButtonImpl(props: EntityLabelButtonProps) {
  const { onClick, buttonStyle, ...labelProps } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        padding: 0,
        margin: 0,
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        minWidth: 0,
        maxWidth: '100%',
        ...buttonStyle,
      }}
    >
      <EntityLabel {...labelProps} />
    </button>
  );
}

export const EntityLabelButton = React.memo(
  EntityLabelButtonImpl,
  (left, right) =>
    left.label === right.label &&
    left.iconKey === right.iconKey &&
    left.size === right.size &&
    left.gap === right.gap &&
    left.onClick === right.onClick &&
    areStringArraysEqual(left.atlasIds, right.atlasIds) &&
    areFlatStyleObjectsEqual(left.textStyle, right.textStyle) &&
    areFlatStyleObjectsEqual(left.buttonStyle, right.buttonStyle)
);
