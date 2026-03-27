export default function Loading() {
  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page title */}
        <div className="h-8 w-36 bg-white/5 rounded animate-pulse" />

        {/* Description */}
        <div className="h-4 w-72 bg-white/5 rounded animate-pulse" />

        {/* Tool cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 bg-white/5 border border-white/10 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
