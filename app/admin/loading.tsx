export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <div className="hidden md:flex w-56 flex-col border-r border-white/10 p-4 gap-3">
        <div className="h-8 w-28 bg-white/5 rounded animate-pulse mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-white/5 border border-white/10 rounded-xl animate-pulse"
            />
          ))}
        </div>

        {/* Table / content block */}
        <div className="h-72 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
