import React from 'react';

interface DatasetEditorPanelProps {
  title: string;
  helpText: string;
  datasetLabel: string;
  defaultsLabel: string;
  datasetText: string;
  defaultConfigText: string;
  applyButtonLabel: string;
  resetButtonLabel: string;
  errorText: string;
  onDatasetTextChange: (value: string) => void;
  onDefaultConfigTextChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 220,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.18)',
  padding: 12,
  fontSize: 13,
  lineHeight: 1.5,
  fontFamily: '"IBM Plex Mono", "Consolas", monospace',
  background: 'rgba(255,255,255,0.94)',
  color: '#183359',
  boxSizing: 'border-box',
  resize: 'vertical',
};

const subtleButtonStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.16)',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: 'rgba(24, 51, 89, 0.08)',
  color: '#183359',
};

const primaryButtonStyle: React.CSSProperties = {
  ...subtleButtonStyle,
  background: '#183359',
  color: '#fff',
};

export default function DatasetEditorPanel(props: DatasetEditorPanelProps) {
  const {
    title,
    helpText,
    datasetLabel,
    defaultsLabel,
    datasetText,
    defaultConfigText,
    applyButtonLabel,
    resetButtonLabel,
    errorText,
    onDatasetTextChange,
    onDefaultConfigTextChange,
    onApply,
    onReset,
  } = props;

  return (
    <details style={{ borderTop: '1px solid rgba(24, 51, 89, 0.10)', paddingTop: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{title}</summary>
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(24, 51, 89, 0.72)' }}>
          {helpText}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
              {datasetLabel}
            </div>
            <textarea
              value={datasetText}
              onChange={event => onDatasetTextChange(event.target.value)}
              style={textareaStyle}
            />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
              {defaultsLabel}
            </div>
            <textarea
              value={defaultConfigText}
              onChange={event => onDefaultConfigTextChange(event.target.value)}
              style={textareaStyle}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={onApply} style={primaryButtonStyle}>
            {applyButtonLabel}
          </button>
          <button type="button" onClick={onReset} style={subtleButtonStyle}>
            {resetButtonLabel}
          </button>
        </div>
        {errorText ? (
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              lineHeight: 1.6,
              color: '#8e2020',
              background: 'rgba(180, 41, 41, 0.08)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            {errorText}
          </pre>
        ) : null}
      </div>
    </details>
  );
}
