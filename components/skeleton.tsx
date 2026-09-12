/**
 * 011-module-navigation-performance (contracts/module-page-pattern.md):
 * small building blocks for every module's `loading.tsx`. Purely static —
 * no data fetching, no auth check — just a lightweight visual placeholder
 * shown immediately while the real `page.tsx` resolves.
 */

export function SkeletonHeader() {
  return <div className="skeleton-block skeleton-header" aria-hidden="true" />;
}

/** A row shaped like a typical list item (thumbnail/icon + two lines of text). */
export function SkeletonRow() {
  return (
    <div className="skeleton-row" aria-hidden="true">
      <div className="skeleton-block" />
      <div className="skeleton-row-lines">
        <div className="skeleton-block" />
        <div className="skeleton-block" />
      </div>
    </div>
  );
}

/** A vertical stack of `SkeletonRow`s — the default shape for this app's list-style modules. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      <SkeletonHeader />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** A tile-shaped placeholder, matching `.tile`/`.grid` layouts (Panel, Facilities). */
export function SkeletonTile() {
  return (
    <div className="skeleton-tile" aria-hidden="true">
      <div className="skeleton-block" />
      <div className="skeleton-block" style={{ height: 22, width: '50%' }} />
      <div className="skeleton-block" style={{ height: 12, width: '70%' }} />
    </div>
  );
}

/** A grid of `SkeletonTile`s — for tile/card-grid modules (Panel, Facilities). */
export function SkeletonGrid({ tiles = 6 }: { tiles?: number }) {
  return (
    <div>
      <SkeletonHeader />
      <div className="grid">
        {Array.from({ length: tiles }, (_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    </div>
  );
}

/** A single card-shaped placeholder — for single-record/settings modules (Customization). */
export function SkeletonCard() {
  return (
    <div>
      <SkeletonHeader />
      <div className="card card-pad" aria-hidden="true">
        <div className="skeleton-block" style={{ height: 16, width: '30%', marginBottom: 16 }} />
        <div className="skeleton-block" style={{ height: 40, width: '100%', marginBottom: 12 }} />
        <div className="skeleton-block" style={{ height: 16, width: '20%', marginBottom: 16 }} />
        <div className="skeleton-block" style={{ height: 80, width: 80, borderRadius: '50%' }} />
      </div>
    </div>
  );
}
