/**
 * CODE LAB LOADING STATE
 *
 * Shown during server-side auth check and while CodeLabClient mounts.
 * Skeleton layout matches the Code Lab IDE interface for seamless transition.
 */

export default function CodeLabLoading() {
  return (
    <div className="flex h-screen bg-background">
      {/* Left sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r border-border/40 bg-card/50">
        <div className="p-3">
          <div className="h-9 animate-pulse bg-muted/30" />
        </div>
        <div className="flex-1 px-2 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse bg-muted/30"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col">
        {/* Tab bar skeleton */}
        <div className="h-10 border-b border-border/40 flex items-center px-3 gap-2">
          <div className="h-6 w-24 animate-pulse bg-muted/30" />
          <div className="h-6 w-20 animate-pulse bg-muted/30 opacity-60" />
        </div>

        {/* Editor content skeleton */}
        <div className="flex-1 p-4 space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-4 w-8 animate-pulse bg-muted/30 opacity-40" />
              <div
                className="h-4 animate-pulse bg-muted/30"
                style={{
                  width: `${30 + Math.floor((i * 37) % 50)}%`,
                  opacity: 0.8 - i * 0.05,
                }}
              />
            </div>
          ))}
        </div>

        {/* Terminal/output skeleton */}
        <div className="h-48 border-t border-border/40 bg-card/50">
          <div className="h-8 border-b border-border/40 flex items-center px-3">
            <div className="h-4 w-20 animate-pulse bg-muted/30" />
          </div>
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-3 animate-pulse bg-muted/30"
                style={{
                  width: `${40 + ((i * 23) % 40)}%`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
