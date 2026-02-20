import { useState, useEffect, useCallback } from 'react';

interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  timezone: string;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

async function generateFingerprint(): Promise<DeviceInfo> {
  const components: string[] = [];

  components.push(navigator.userAgent);
  components.push(navigator.language);
  components.push(navigator.platform);

  if (screen) {
    components.push(`${screen.width}x${screen.height}`);
    components.push(`${screen.colorDepth}`);
  }

  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  if ('deviceMemory' in navigator) {
    components.push(String((navigator as any).deviceMemory));
  }

  if ('hardwareConcurrency' in navigator) {
    components.push(String(navigator.hardwareConcurrency));
  }

  if (typeof window !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('fingerprint', 2, 15);
        components.push(canvas.toDataURL().slice(0, 100));
      }
    } catch {
      // Canvas not available
    }
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(components.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    fingerprint,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: screen ? `${screen.width}x${screen.height}` : 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    colorDepth: screen?.colorDepth || 24,
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency
  };
}

export function useDeviceFingerprint() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateFingerprint()
      .then(info => {
        setDeviceInfo(info);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const getFingerprint = useCallback(() => {
    return deviceInfo?.fingerprint || null;
  }, [deviceInfo]);

  return {
    deviceInfo,
    fingerprint: deviceInfo?.fingerprint || null,
    loading,
    getFingerprint
  };
}
