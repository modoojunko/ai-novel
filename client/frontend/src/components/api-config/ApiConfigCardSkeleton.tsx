export function ApiConfigCardSkeleton() {
  return (
    <div
      className="card bg-base-100 border border-base-300 p-5 space-y-4"
      data-loaded="false"
    >
      <div className="flex items-center gap-3">
        <div className="skeleton h-9 w-9 rounded-lg" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-3 w-40" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-3/4" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-6 w-16 rounded-full" />
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <div className="skeleton h-8 w-16 rounded-btn" />
        <div className="skeleton h-8 w-16 rounded-btn" />
      </div>
    </div>
  );
}
