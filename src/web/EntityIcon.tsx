import React from 'react';
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

export function EntityIcon(props: EntityIconProps) {
  const { label, iconKey, atlasIds, size = 22 } = props;
  const resolvedIcon = getResolvedIconSprite(iconKey, atlasIds);
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

export function EntityLabel(props: EntityLabelProps) {
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

export function EntityLabelButton(props: EntityLabelButtonProps) {
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
