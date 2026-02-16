'use client';

import { useEffect } from 'react';

export default function PWARegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => {
          // Service worker registered successfully
        })
        .catch(() => {
          // Service worker registration failed - silent fail for production
        });
    }
  }, []);

  return null;
}