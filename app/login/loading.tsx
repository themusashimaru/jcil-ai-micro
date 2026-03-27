export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 border border-white/10 rounded-2xl p-8">
        {/* Logo / heading */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-white/5 rounded-full animate-pulse" />
          <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
        </div>

        {/* Email field */}
        <div className="h-11 bg-white/5 rounded-lg animate-pulse" />

        {/* Password field */}
        <div className="h-11 bg-white/5 rounded-lg animate-pulse" />

        {/* Submit button */}
        <div className="h-11 bg-white/5 rounded-lg animate-pulse" />

        {/* Footer link */}
        <div className="h-4 w-48 mx-auto bg-white/5 rounded animate-pulse" />
      </div>
    </div>
  );
}
