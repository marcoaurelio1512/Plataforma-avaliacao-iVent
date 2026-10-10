/** Assinatura visual: o traçado de pressão do iVent + nome do módulo. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--surface-3)" />
      <path d="M4 20h5l2-9 3 13 3-16 2 12h9" fill="none" stroke="var(--oxygenation)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <BrandMark />
      {!compact && (
        <div className="brand-text">
          <strong>iVent NeoPed</strong>
          <span>Avaliação</span>
        </div>
      )}
    </div>
  );
}
