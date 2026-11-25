import type { CSSProperties } from 'react';

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({
  width = '100%',
  height = '16px',
  radius,
  circle = false,
  className = '',
  style,
}: SkeletonProps) {
  const customStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: circle ? '50%' : radius != null ? (typeof radius === 'number' ? `${radius}px` : radius) : undefined,
    ...style,
  };

  return <span className={`skeleton ${className}`.trim()} style={customStyle} aria-hidden="true" />;
}

/** Skeleton para a lista de histórico (Estações e Simulados) */
export function HistSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="hist-skeleton-list" aria-label="Carregando histórico" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h skeleton-h" style={{ opacity: 1 - i * 0.15 }}>
          <div className="h-main" style={{ width: '100%' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Skeleton width="180px" height="18px" />
                <Skeleton width="65px" height="20px" radius="999px" />
              </div>
              <Skeleton width="230px" height="13px" style={{ marginBottom: 6 }} />
              <Skeleton width="150px" height="12px" />
            </div>
            <Skeleton width="48px" height="32px" radius="8px" style={{ marginLeft: 16 }} />
          </div>
          <div className="h-actions">
            <Skeleton width="52px" height="32px" radius="6px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton para a tela inicial de Simulados */
export function SimuladosHomeSkeleton() {
  return (
    <div className="simulados-skeleton" aria-label="Carregando simulados" aria-busy="true">
      <div className="card stack" style={{ marginBottom: 24 }}>
        <Skeleton width="160px" height="22px" style={{ marginBottom: 16 }} />
        <div style={{ marginBottom: 14 }}>
          <Skeleton width="80px" height="14px" style={{ marginBottom: 6 }} />
          <Skeleton height="42px" radius="6px" />
        </div>
        <div className="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div>
            <Skeleton width="70px" height="14px" style={{ marginBottom: 6 }} />
            <Skeleton height="42px" radius="6px" />
          </div>
          <div>
            <Skeleton width="90px" height="14px" style={{ marginBottom: 6 }} />
            <Skeleton height="42px" radius="6px" />
          </div>
          <div>
            <Skeleton width="85px" height="14px" style={{ marginBottom: 6 }} />
            <Skeleton height="42px" radius="6px" />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Skeleton width="130px" height="42px" radius="8px" />
        </div>
      </div>

      <Skeleton width="150px" height="22px" style={{ margin: '26px 0 14px' }} />

      <div className="simlist">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="simitem-wrap" style={{ marginBottom: 10 }}>
            <div className="simitem" style={{ pointerEvents: 'none' }}>
              <div
                className="simitem-main"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <Skeleton width="220px" height="18px" style={{ marginBottom: 6 }} />
                  <Skeleton width="160px" height="13px" />
                </div>
                <Skeleton width="48px" height="24px" radius="999px" />
              </div>
              <div className="simitem-actions" style={{ display: 'flex', gap: 6 }}>
                <Skeleton width="60px" height="34px" radius="6px" />
                <Skeleton width="60px" height="34px" radius="6px" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton para a tela interna de um Simulado */
export function SimPageSkeleton() {
  return (
    <div className="sim-page-skeleton" aria-label="Carregando simulado" aria-busy="true">
      <Skeleton width="160px" height="16px" style={{ marginBottom: 12 }} />
      <Skeleton width="320px" height="30px" style={{ marginBottom: 16 }} />

      <div className="tabs" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <Skeleton width="100px" height="38px" radius="8px" />
        <Skeleton width="90px" height="38px" radius="8px" />
        <Skeleton width="110px" height="38px" radius="8px" />
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <Skeleton width="200px" height="20px" />
          <Skeleton width="120px" height="32px" radius="6px" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <Skeleton width="180px" height="16px" />
              <Skeleton width="120px" height="24px" radius="6px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton para o Hub principal */
export function HubSkeleton() {
  return (
    <div className="hub-skeleton" aria-label="Carregando painel inicial" aria-busy="true">
      <div className="page-head" style={{ marginBottom: 20 }}>
        <Skeleton width="220px" height="32px" style={{ marginBottom: 8 }} />
        <Skeleton width="300px" height="16px" />
      </div>

      <div
        className="stats"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="stat">
            <Skeleton width="50px" height="32px" style={{ marginBottom: 6, marginInline: 'auto' }} />
            <Skeleton width="70px" height="13px" style={{ marginInline: 'auto' }} />
          </div>
        ))}
      </div>

      <div className="sec-head" style={{ marginBottom: 12 }}>
        <Skeleton width="100px" height="22px" />
      </div>

      <div
        className="mod-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <Skeleton width="50px" height="18px" radius="999px" style={{ marginBottom: 12 }} />
            <Skeleton width="160px" height="20px" style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height="14px" style={{ marginBottom: 6 }} />
            <Skeleton width="80%" height="14px" style={{ marginBottom: 16 }} />
            <Skeleton height="40px" radius="8px" />
          </div>
        ))}
      </div>

      <div className="sec-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton width="90px" height="22px" />
        <Skeleton width="60px" height="16px" />
      </div>

      <div className="card recent" style={{ padding: 0 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h"
            style={{
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: i < 2 ? '1px solid var(--line)' : 'none',
            }}
          >
            <div style={{ flex: 1 }}>
              <Skeleton width="190px" height="16px" style={{ marginBottom: 6 }} />
              <Skeleton width="140px" height="12px" />
            </div>
            <Skeleton width="40px" height="24px" radius="6px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton universal para carregamento geral da página / Auth */
export function PageSkeleton() {
  return (
    <div className="page-skeleton wrap" aria-label="Carregando página" aria-busy="true">
      <div className="page-head" style={{ marginBottom: 24 }}>
        <Skeleton width="240px" height="32px" style={{ marginBottom: 8 }} />
        <Skeleton width="340px" height="16px" />
      </div>
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <Skeleton width="180px" height="20px" style={{ marginBottom: 16 }} />
        <Skeleton height="44px" radius="8px" style={{ marginBottom: 12 }} />
        <Skeleton height="44px" radius="8px" style={{ marginBottom: 12 }} />
        <Skeleton width="140px" height="42px" radius="8px" style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}
