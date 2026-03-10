/**
 * useDeviceInfo — Detects user's OS, browser, and device type from the browser.
 *
 * Used to pass device context to the chat API so the AI can give
 * OS-specific IT support instructions without the user having to say
 * "I'm on Windows" every time.
 */

'use client';

import { useMemo } from 'react';

export interface DeviceInfo {
  os: string;
  osVersion: string;
  browser: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

function detectOS(ua: string): { os: string; osVersion: string } {
  if (/Windows NT 10/.test(ua)) {
    // Windows 10 and 11 both report "Windows NT 10.0"
    // Can't reliably distinguish, but navigator.userAgentData can on Chromium
    return { os: 'Windows', osVersion: '10/11' };
  }
  if (/Windows NT 6\.3/.test(ua)) return { os: 'Windows', osVersion: '8.1' };
  if (/Windows NT 6\.1/.test(ua)) return { os: 'Windows', osVersion: '7' };
  if (/Windows/.test(ua)) return { os: 'Windows', osVersion: '' };

  if (/Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    const version = match ? match[1].replace(/_/g, '.') : '';
    return { os: 'macOS', osVersion: version };
  }

  if (/CrOS/.test(ua)) return { os: 'ChromeOS', osVersion: '' };
  if (/Android/.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    return { os: 'Android', osVersion: match ? match[1] : '' };
  }
  if (/iPhone|iPad|iPod/.test(ua)) {
    const match = ua.match(/OS (\d+[._]\d+)/);
    const version = match ? match[1].replace(/_/g, '.') : '';
    return { os: 'iOS', osVersion: version };
  }
  if (/Linux/.test(ua)) return { os: 'Linux', osVersion: '' };

  return { os: 'Unknown', osVersion: '' };
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Unknown';
}

function detectDeviceType(ua: string): 'desktop' | 'tablet' | 'mobile' {
  if (/iPad|Android(?!.*Mobile)/.test(ua) && !/Mobile/.test(ua)) return 'tablet';
  if (/Mobile|iPhone|iPod|Android.*Mobile/.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Returns stable device info detected from the user agent.
 * Safe to call on server (returns defaults) — only meaningful on client.
 */
export function useDeviceInfo(): DeviceInfo {
  return useMemo(() => {
    if (typeof navigator === 'undefined') {
      return { os: 'Unknown', osVersion: '', browser: 'Unknown', deviceType: 'desktop' as const };
    }

    const ua = navigator.userAgent;
    const { os, osVersion } = detectOS(ua);

    // Try to get better Windows version via userAgentData (Chromium only)
    let finalOs = os;
    let finalVersion = osVersion;
    if (os === 'Windows' && 'userAgentData' in navigator) {
      const uad = navigator.userAgentData as
        | { platform?: string; platformVersion?: string }
        | undefined;
      if (uad?.platform === 'Windows' && uad.platformVersion) {
        const major = parseInt(uad.platformVersion.split('.')[0], 10);
        finalVersion = major >= 13 ? '11' : '10';
        finalOs = 'Windows';
      }
    }

    return {
      os: finalOs,
      osVersion: finalVersion,
      browser: detectBrowser(ua),
      deviceType: detectDeviceType(ua),
    };
  }, []);
}
