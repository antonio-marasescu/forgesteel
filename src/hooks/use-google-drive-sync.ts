/**
 * useGoogleDriveSync Hook
 *
 * Provides auto-sync functionality for Google Drive storage.
 * Debounces changes and syncs to Google Drive after a delay.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type DriveSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface DriveSyncState {
  status: DriveSyncStatus;
  lastSyncTime: Date | null;
  error: string | null;
  pendingChanges: boolean;
}

interface UseGoogleDriveSyncOptions {
  enabled: boolean;
  debounceMs?: number;
  onSync?: () => Promise<void>;
  onError?: (error: Error) => void;
}

export const useGoogleDriveSync = (options: UseGoogleDriveSyncOptions) => {
  const { enabled, debounceMs = 2000, onSync, onError } = options;

  const [state, setState] = useState<DriveSyncState>({
    status: 'idle',
    lastSyncTime: null,
    error: null,
    pendingChanges: false,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);
  const pendingAfterSyncRef = useRef(false);

  // Check online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update status based on online state
  useEffect(() => {
    if (!isOnline && state.status !== 'offline') {
      setState(prev => ({
        ...prev,
        status: 'offline',
      }));
    } else if (isOnline && state.status === 'offline') {
      setState(prev => ({
        ...prev,
        status: prev.pendingChanges ? 'idle' : 'synced',
      }));
    }
  }, [isOnline, state.status, state.pendingChanges]);

  /**
   * Perform the actual sync operation
   */
  const performSync = useCallback(async () => {
    if (!enabled || !onSync || !isOnline) {
      return;
    }

    if (isSyncingRef.current) {
      // Mark that we need another sync after current one completes
      pendingAfterSyncRef.current = true;
      return;
    }

    isSyncingRef.current = true;
    setState(prev => ({
      ...prev,
      status: 'syncing',
      error: null,
    }));

    try {
      await onSync();

      setState(prev => ({
        ...prev,
        status: 'synced',
        lastSyncTime: new Date(),
        pendingChanges: false,
        error: null,
      }));

      // Check if there were changes while syncing
      if (pendingAfterSyncRef.current) {
        pendingAfterSyncRef.current = false;
        // Schedule another sync
        setTimeout(() => performSync(), debounceMs);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      console.error('Google Drive sync error:', error);

      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));

      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [enabled, onSync, onError, isOnline, debounceMs]);

  /**
   * Trigger a sync (with debounce)
   * Call this when data changes
   */
  const triggerSync = useCallback(() => {
    if (!enabled) {
      return;
    }

    // Mark that we have pending changes
    setState(prev => ({
      ...prev,
      pendingChanges: true,
      status: prev.status === 'synced' ? 'idle' : prev.status,
    }));

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      performSync();
    }, debounceMs);
  }, [enabled, debounceMs, performSync]);

  /**
   * Force immediate sync (bypasses debounce)
   */
  const forceSync = useCallback(() => {
    if (!enabled) {
      return;
    }

    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    performSync();
  }, [enabled, performSync]);

  /**
   * Clear any pending sync
   */
  const cancelPendingSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      pendingChanges: false,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Sync when coming back online if there are pending changes
  useEffect(() => {
    if (isOnline && state.pendingChanges && enabled) {
      triggerSync();
    }
  }, [isOnline, state.pendingChanges, enabled, triggerSync]);

  return {
    ...state,
    isOnline,
    triggerSync,
    forceSync,
    cancelPendingSync,
  };
};

/**
 * Get a human-readable status message
 */
export const getDriveSyncStatusMessage = (state: DriveSyncState, isOnline: boolean): string => {
  if (!isOnline) {
    return 'Offline - changes will sync when online';
  }

  switch (state.status) {
    case 'syncing':
      return 'Syncing to Google Drive...';
    case 'synced':
      return state.lastSyncTime
        ? `Synced to Google Drive at ${state.lastSyncTime.toLocaleTimeString()}`
        : 'Synced to Google Drive';
    case 'error':
      return `Sync error: ${state.error || 'Unknown error'}`;
    case 'offline':
      return 'Offline - changes will sync when online';
    case 'idle':
    default:
      return state.pendingChanges ? 'Changes pending...' : 'Ready';
  }
};
