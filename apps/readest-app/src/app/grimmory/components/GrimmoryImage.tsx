'use client';

import { useEffect, useState } from 'react';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriAppPlatform, isWebAppPlatform } from '@/services/environment';

interface GrimmoryImageProps {
  /** Direct URL (for Tauri) or proxy URL (for web) */
  src: string;
  /** Authorization header value (e.g. "Bearer xxx") - needed for Tauri direct requests */
  authHeader?: string;
  alt: string;
  className?: string;
  onError?: () => void;
}

/**
 * Image component that handles Grimmory's authenticated image endpoints.
 * - On web: uses the proxy URL that already includes auth info
 * - On Tauri: uses tauriFetch with Authorization header and creates a blob URL
 */
export function GrimmoryImage({ src, authHeader, alt, className, onError }: GrimmoryImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked = false;
    let blobUrl: string | null = null;

    const load = async () => {
      // Web mode: the proxy URL already handles auth, use directly
      if (isWebAppPlatform()) {
        setObjectUrl(src);
        return;
      }

      // Tauri mode: fetch with auth header
      if (!src) return;

      try {
        const headers: Record<string, string> = {};
        if (authHeader) {
          headers['Authorization'] = authHeader;
        }
        const fetchFn = isTauriAppPlatform() ? tauriFetch : window.fetch;
        const res = await fetchFn(src, {
          headers,
          danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
        });

        if (!res.ok) {
          if (!revoked) {
            setError(true);
            onError?.();
          }
          return;
        }

        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        if (!revoked) {
          setObjectUrl(blobUrl);
        } else {
          URL.revokeObjectURL(blobUrl);
        }
      } catch {
        if (!revoked) {
          setError(true);
          onError?.();
        }
      }
    };

    load();

    return () => {
      revoked = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, authHeader]);

  if (error) {
    return null;
  }

  if (!objectUrl) {
    return <div className={`bg-base-300 animate-pulse ${className || ''}`} />;
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={className}
      onError={() => {
        setError(true);
        onError?.();
      }}
    />
  );
}
