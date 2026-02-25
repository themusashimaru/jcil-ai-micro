/**
 * CHAT PAGE LOADING STATE
 *
 * Shown during initial server-side auth check and while ChatClient mounts.
 * Uses skeleton components to match the chat layout for seamless transition.
 */

export default function ChatLoading() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-72 flex-col border-r border-theme bg-glass">
        <div className="p-4">
          <div className="h-10 rounded-lg animate-pulse bg-glass" />
        </div>
        <div className="flex-1 px-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg animate-pulse bg-glass"
              style={{ opacity: 1 - i * 0.12 }}
            />
          ))}
        </div>
      </div>

      {/* Main chat area skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-theme flex items-center px-4">
          <div className="h-6 w-32 rounded animate-pulse bg-glass" />
        </div>

        {/* Welcome area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl mx-auto animate-pulse bg-glass" />
            <div className="h-6 w-64 rounded mx-auto animate-pulse bg-glass" />
            <div className="h-4 w-48 rounded mx-auto animate-pulse bg-glass opacity-60" />
          </div>
        </div>

        {/* Composer skeleton */}
        <div className="p-4">
          <div className="h-14 rounded-xl animate-pulse bg-glass border border-theme" />
        </div>
      </div>
    </div>
  );
}
