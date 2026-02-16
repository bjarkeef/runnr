'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

const SYNC_CHECK_KEY = 'runnr_last_sync_check';

interface AutoSyncResult {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<void>;
}

export function useAutoSync(isAuthenticated: boolean): AutoSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const hasChecked = useRef(false);
  const router = useRouter();

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-runs', {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setLastSyncedAt(new Date(data.lastSyncedAt));
        
        // Store last sync check time in localStorage
        localStorage.setItem(SYNC_CHECK_KEY, Date.now().toString());
        
        console.log(`[AutoSync] Synced ${data.synced} new runs, ${data.skipped} skipped`);

        // Refresh the UI so server components show updated data
        try {
          router.refresh();
        } catch (e) {
          // ignore router refresh errors (still continue)
        }
      }
    } catch (error) {
      console.error('[AutoSync] Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, router]);

  useEffect(() => {
    if (!isAuthenticated || hasChecked.current) return;
    hasChecked.current = true;

    const checkAndSync = async () => {
      try {
        // First check localStorage for recent sync check (prevents multiple API calls)
        const lastCheckStr = localStorage.getItem(SYNC_CHECK_KEY);
        const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
        const timeSinceLastCheck = Date.now() - lastCheck;
        
        // If we checked recently (within 1 hour), skip the API call
        if (timeSinceLastCheck < 60 * 60 * 1000) {
          console.log('[AutoSync] Recently checked, skipping');
          return;
        }

        // Check server for last sync time
        const response = await fetch('/api/sync-status');
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.lastSyncedAt) {
          setLastSyncedAt(new Date(data.lastSyncedAt));
        }
        
        // Determine if we need to sync
        const needsSync = data.needsSync || !data.lastSyncedAt;
        
        if (needsSync) {
          console.log('[AutoSync] Triggering automatic sync...');
          await triggerSync();
        } else {
          // Update localStorage even if we don't sync
          localStorage.setItem(SYNC_CHECK_KEY, Date.now().toString());
          console.log('[AutoSync] Data is up to date');
        }
      } catch (error) {
        console.error('[AutoSync] Check failed:', error);
      }
    };

    // Small delay to not block initial page load
    const timeoutId = setTimeout(checkAndSync, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, triggerSync]);

  return { isSyncing, lastSyncedAt, triggerSync };
}
