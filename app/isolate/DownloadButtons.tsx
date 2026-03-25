'use client';

import { useEffect, useState } from 'react';

const MAC_ARM_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest/download/JCIL-Isolate-mac-arm64.zip';
const MAC_INTEL_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest/download/JCIL-Isolate-mac-x64.zip';
const WINDOWS_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest/download/JCIL-Isolate-win-x64.exe';
const ANDROID_URL = 'https://github.com/themusashimaru/jcil-isolate-android/releases/latest/download/JCIL-Isolate-1.0.0-android.apk';

type Platform = 'mac-arm' | 'mac-intel' | 'windows' | 'android' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase() || navigator.platform?.toLowerCase() || '';

  if (/android/i.test(ua)) return 'android';
  if (/win/i.test(platform) || /win/i.test(ua)) return 'windows';
  if (/mac/i.test(platform) || /mac/i.test(ua)) {
    // Check for Apple Silicon
    if (/arm/i.test(ua) || (typeof navigator !== 'undefined' && navigator.hardwareConcurrency >= 8)) {
      return 'mac-arm';
    }
    return 'mac-arm'; // Default to ARM for modern Macs
  }
  return 'unknown';
}

const platforms = [
  { id: 'mac-arm' as Platform, label: 'Mac (Apple Silicon)', url: MAC_ARM_URL, icon: 'apple', primary: true },
  { id: 'mac-intel' as Platform, label: 'Mac (Intel)', url: MAC_INTEL_URL, icon: 'apple', primary: false },
  { id: 'windows' as Platform, label: 'Windows', url: WINDOWS_URL, icon: 'windows', primary: false },
  { id: 'android' as Platform, label: 'Mobile: Android', url: ANDROID_URL, icon: 'android', primary: false },
];

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
);

const WindowsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
);

const AndroidIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
);

export function DownloadButtons() {
  const [detected, setDetected] = useState<Platform>('unknown');

  useEffect(() => {
    setDetected(detectPlatform());
  }, []);

  // Sort: detected platform first, then rest
  const sorted = [...platforms].sort((a, b) => {
    if (a.id === detected) return -1;
    if (b.id === detected) return 1;
    return 0;
  });

  const Icon = ({ type }: { type: string }) => {
    if (type === 'apple') return <AppleIcon />;
    if (type === 'windows') return <WindowsIcon />;
    if (type === 'android') return <AndroidIcon />;
    return null;
  };

  return (
    <div>
      {/* Big recommended button */}
      {detected !== 'unknown' && (
        <div className="mb-6">
          <span className="block font-mono text-[10px] uppercase tracking-widest text-green-400 mb-2">
            Recommended for your device
          </span>
          <a
            href={sorted[0].url}
            className="inline-flex items-center gap-4 border-2 border-green-500/40 bg-green-500/10 px-10 py-5 font-mono text-base uppercase tracking-widest text-green-400 hover:bg-green-500/20 hover:border-green-500/60 transition-all duration-200"
          >
            <Icon type={sorted[0].icon} />
            Download for {sorted[0].label}
          </a>
        </div>
      )}

      {/* Other platforms */}
      <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 mt-8">
        All platforms
      </span>
      <div className="flex flex-wrap gap-3">
        {platforms.map((p) => (
          <a
            key={p.id}
            href={p.url}
            className={`inline-flex items-center gap-3 border px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200 ${
              p.id === detected
                ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : 'border-foreground/20 text-foreground hover:border-foreground/40'
            }`}
          >
            <Icon type={p.icon} />
            {p.label}
          </a>
        ))}
      </div>

      <p className="mt-4 font-mono text-[10px] text-muted-foreground/50">
        Mac: Right-click &gt; Open if you see a security warning. Android: Allow &quot;Install from unknown sources&quot; when prompted.
      </p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
        Android requires 6GB+ RAM. Samsung S21+, Pixel 6+, OnePlus 9+, or newer.
      </p>
    </div>
  );
}
