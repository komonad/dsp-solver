import React from 'react';

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(18, 45, 77, 0.12)',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 24px 80px rgba(24, 51, 89, 0.12)',
};

export default function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        background:
          'radial-gradient(circle at top left, rgba(244, 194, 102, 0.28), transparent 35%), linear-gradient(135deg, #f5efe2 0%, #dce7ef 48%, #f7f8fb 100%)',
        color: '#183359',
        fontFamily: '"IBM Plex Sans", "Noto Sans SC", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '64px 24px 80px',
          display: 'grid',
          gap: 20,
        }}
      >
        <section style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'inline-block',
              width: 'fit-content',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(24, 51, 89, 0.08)',
              letterSpacing: '0.08em',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            REFACTOR IN PROGRESS
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(2.4rem, 5vw, 4.2rem)',
              lineHeight: 1.02,
              maxWidth: 780,
            }}
          >
            The rebuild now treats dataset defaults as configurable input, not as hardcoded
            vanilla semantics.
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 760,
              fontSize: 18,
              lineHeight: 1.65,
              color: 'rgba(24, 51, 89, 0.82)',
            }}
          >
            The current page is only a placeholder for the new architecture. Raw catalog data comes
            from a vanilla-compatible dataset file, while dataset-coupled defaults live in a
            separate optional default-config file that users will later be able to override in
            solver input.
          </p>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
          }}
        >
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Raw Dataset</h2>
            <p style={{ marginBottom: 0, lineHeight: 1.65 }}>
              `Vanilla.json` remains the raw source format. It only carries items and recipes.
            </p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Default Config</h2>
            <p style={{ marginBottom: 0, lineHeight: 1.65 }}>
              Dataset-coupled defaults such as proliferator tables and modifier-code meanings now
              live in an optional companion config file instead of code.
            </p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Web Boundary</h2>
            <p style={{ marginBottom: 0, lineHeight: 1.65 }}>
              The future web layer will render solver output directly and must not invent its own
              calculations.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
