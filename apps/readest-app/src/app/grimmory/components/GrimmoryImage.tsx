'use client';

import { useEffect, useState } from 'react';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriAppPlatform } from '@/services/environment';

interface GrimmoryImageProps {
  /** Direct URL or proxy URL for the image */
  src: string;
  /** Authorization header value (e.g. "Bearer xxx") */
  authHeader?: string;
  alt: string;
  className?: string;
  onError?: () => void;
}

/**
 * Image component that handles Grimmory's authenticated image endpoints.
 * Always fetches via the appropriate fetch function (tauriFetch on Tauri,
 * window.fetch elsewhere) with the Authorization header and renders a blob URL.
 * This correctly handles both direct server URLs (LAN) and proxy URLs.
 */
export function GrimmoryImage({ src, authHeader, alt, className, onError }: GrimmoryImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked = false;
    let blobUrl: string | null = null;

    const load = async () => {
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
