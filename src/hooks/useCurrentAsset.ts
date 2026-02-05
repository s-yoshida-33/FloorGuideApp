import { useEffect, useState, useRef, useCallback } from 'react';
import type { CurrentAsset } from '../types/wsp';
import { logWarn, logInfo, logError } from '../logs/logging';
import { cmsClient } from '../api/cmsClient';
import { APP_CONFIG } from '../config';

interface UseCurrentAssetResult {
  asset: CurrentAsset | null;
  isLoading: boolean;
  deviceCode: string | null;
}

export function useCurrentAsset(
  _retryIntervalMs: number = 3000,
): UseCurrentAssetResult {
  const [asset, setAsset] = useState<CurrentAsset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  
  // Polling function to get status from CMS
  const fetchStatus = useCallback(async () => {
    try {
      // Get device code from settings via IPC (provided by preload script)
      let currentDeviceCode: string | null = null;
      
      try {
        if ((window as any).electronAPI?.getDeviceCode) {
          const code = await (window as any).electronAPI.getDeviceCode();
          if (code) currentDeviceCode = code;
        }
      } catch (e) {
        logError('video', 'Failed to get device code from IPC', { error: e });
      }

      // If no code exists (first launch), generate one via API
      if (!currentDeviceCode) {
         const newCode = await cmsClient.generateDeviceCode();
         if (newCode) {
            currentDeviceCode = newCode;
            // Save to settings
            try {
              if ((window as any).electronAPI?.saveDeviceCode) {
                await (window as any).electronAPI.saveDeviceCode(newCode);
              }
            } catch (e) {
               logError('video', 'Failed to save generated device code', { error: e });
            }
         } else {
            // Fallback to config default if generation fails
            currentDeviceCode = APP_CONFIG.defaultDeviceCode;
            logWarn('video', 'Failed to generate device code, using default', { code: currentDeviceCode });
         }
      }

      if (isMountedRef.current) {
        setDeviceCode(currentDeviceCode);
      }
      
      let status = null;
      if (currentDeviceCode) {
        try {
          status = await cmsClient.getDeviceStatus(currentDeviceCode);
        } catch (e: any) {
          // If device code is invalid (404), clear it to force regeneration
          if (e.status === 404) {
             logWarn('video', 'Device code invalidated (404), clearing to regenerate...', { code: currentDeviceCode });
             
             // Clear local variable to skip processing
             currentDeviceCode = null;
             // Clear state
             if (isMountedRef.current) setDeviceCode(null);
             
             // Clear settings
             try {
               if ((window as any).electronAPI?.saveDeviceCode) {
                 await (window as any).electronAPI.saveDeviceCode(null);
               }
             } catch (err) {
               // ignore
             }
          }
        }
      }
      
      if (!isMountedRef.current) return;

      if (status && status.current_schedule && status.current_schedule.current_programs) {
        // Basic implementation: Pick the first item of the first program
        // TODO: Implement full playlist scheduling (sequencing, looping, duration handling)
        const program = status.current_schedule.current_programs[0];
        if (program && program.items && program.items.length > 0) {
          const item = program.items[0];
          
          if (item.media && item.media.url) {
             setAsset(prev => {
               // Avoid unnecessary updates if ID hasn't changed
               if (prev?.id === item.media!.id) return prev;
               
               logInfo('video', `Updating asset from CMS: ${item.media!.filename}`);
               return {
                 id: item.media!.id,
                 src: item.media!.url, // Use remote URL directly
                 duration: item.duration,
                 width: 1920, // TODO: Get from media metadata
                 height: 1080,
                 name: item.media!.filename,
                 startTime: new Date().toISOString(),
                 // Calculate simplified end time based on duration
                 endTime: new Date(Date.now() + item.duration * 1000).toISOString(),
                 mediaType: item.media!.media_type || 'video', // Default to video if missing
               };
             });
          } else {
            logWarn('video', 'Program item found but missing media URL', { item });
          }
        } else {
          logWarn('video', 'Schedule found but no program items available');
        }
      } else {
        // No active schedule
        // logInfo('video', 'No active schedule received from CMS');
      }
      
      setIsLoading(false);
    } catch (error) {
      if (isMountedRef.current) {
        logError('video', 'Failed to fetch CMS status', { error });
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchStatus();
    
    // Start polling
    const intervalId = setInterval(fetchStatus, APP_CONFIG.pollingIntervalMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchStatus]);

  return { asset, isLoading, deviceCode };
}
