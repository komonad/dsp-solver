import React from 'react';
import {
  getIconAtlasSrc,
  getIconFallbackColor,
  getIconFallbackText,
  getIconSprite,
} from './iconRegistry';

export interface EntityIconProps {
  label: string;
  iconKey?: string;
  size?: number;
}

export interface EntityLabelProps extends EntityIconProps {
  textStyle?: React.CSSProperties;
  gap?: number;
}

export function EntityIcon(props: EntityIconProps) {
  const { label, iconKey, size = 22 } = props;
  const sprite = getIconSprite(iconKey);
  const atlasSrc = getIconAtlasSrc(iconKey);

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
  const { label, iconKey, size = 22, gap = 8, textStyle } = props;

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
      <EntityIcon label={label} iconKey={iconKey} size={size} />
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
