export default function Loading() {
  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page title */}
        <div className="h-8 w-40 bg-white/5 rounded animate-pulse" />

        {/* Tab bar */}
        <div className="flex gap-4 border-b border-white/10 pb-3">
          <div className="h-6 w-24 bg-white/5 rounded animate-pulse" />
          <div className="h-6 w-24 bg-white/5 rounded animate-pulse" />
          <div className="h-6 w-24 bg-white/5 rounded animate-pulse" />
        </div>

        {/* Content area */}
        <div className="space-y-4">
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse mt-6" />
        </div>
      </div>
    </div>
  );
}
