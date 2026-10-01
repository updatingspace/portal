import { SkeletonBlock } from '../skeleton/SkeletonBlock';

export function ListSkeleton({
  label,
  count = 3,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div
      className="portal-list-skeleton"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="portal-list-skeleton__row"
          aria-hidden="true"
        >
          <SkeletonBlock height={18} width="55%" />
          <SkeletonBlock height={14} width="85%" />
          <SkeletonBlock height={14} width="30%" />
        </div>
      ))}
    </div>
  );
}
