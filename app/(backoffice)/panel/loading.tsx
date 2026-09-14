import { SkeletonHeader, SkeletonTile } from '@/components/skeleton';

/**
 * 016-panel-dashboard-overview: matches the real page's `.panel-stats` grid
 * (not the shared `SkeletonGrid`'s `.grid`) so the skeleton's 4-across
 * layout doesn't shift once the real content loads.
 */
export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="panel-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    </div>
  );
}
