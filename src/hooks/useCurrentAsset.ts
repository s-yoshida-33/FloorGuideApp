import { useEffect, useState, useRef, useCallback } from 'react';
import type { CurrentAsset } from '../types/CurrentAsset';
import { logWarn, logInfo, logError } from '../logs/logging';
import { cmsClient } from '../api/cmsClient';
import { wsClient } from '../api/wsClient';
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
  const verifyExpiredAtRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  
  // Track deviceId for WebSocket connection
  const deviceIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastGeneratedTimeRef = useRef<number>(0);

  // Function to process status response and update asset
  const processStatus = useCallback((status: any) => {
    if (!status || !isMountedRef.current) return;

    // Check for ID and save if new (Registration complete)
    if (status.id && status.id !== deviceIdRef.current) {
        const newId = String(status.id);
        logInfo('video', `Device registered. ID: ${newId}`);
        deviceIdRef.current = newId;
        
        // Save ID to settings
        if ((window as any).electronAPI?.saveDeviceId) {
            (window as any).electronAPI.saveDeviceId(newId).catch((e: any) => 
                logError('video', 'Failed to save deviceId', { error: e })
            );
        }

        // Connect WebSocket
        wsClient.connect(newId);
    }

    if (status.current_schedule && status.current_schedule.current_programs) {
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
  }, []);

  // Fetch status from CMS (REST API)
  const fetchStatus = useCallback(async () => {
    try {
      // Get device code from settings via IPC
      let currentDeviceCode: string | null = null;
      let expiresAt: string | null = null;
      
      try {
        if ((window as any).electronAPI?.getDeviceCodeDetails) {
          const details = await (window as any).electronAPI.getDeviceCodeDetails();
          if (details && details.code) {
             currentDeviceCode = details.code;
             expiresAt = details.expiresAt;
          }
        } else if ((window as any).electronAPI?.getDeviceCode) {
          // Fallback for older interface
          const code = await (window as any).electronAPI.getDeviceCode();
          if (code) currentDeviceCode = code;
        }
      } catch (e) {
        logError('video', 'Failed to get device code from IPC', { error: e });
      }

      // Restore expiresAt to ref if we loaded it but ref is empty
      if (expiresAt && !verifyExpiredAtRef.current) {
          verifyExpiredAtRef.current = expiresAt;
      }

      // CRITICAL FIX: If we loaded a code from storage, initialize lastGeneratedTimeRef
      // to prevents "code is ancient" false positives on startup.
      if (currentDeviceCode && lastGeneratedTimeRef.current === 0) {
          lastGeneratedTimeRef.current = Date.now();
      }

      // If no code exists (first launch), generate one via API
      if (!currentDeviceCode) {
         const result = await cmsClient.generateDeviceCode();
         if (result) {
            currentDeviceCode = result.code;
            expiresAt = result.verifyExpiredAt;
            lastGeneratedTimeRef.current = Date.now(); // Mark generation time
            verifyExpiredAtRef.current = result.verifyExpiredAt;
            
            // Save to settings
            try {
              if ((window as any).electronAPI?.saveDeviceCode) {
                // Pass object with code and expiry
                await (window as any).electronAPI.saveDeviceCode({
                    code: result.code,
                    expiresAt: result.verifyExpiredAt
                });
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
        // Check local expiry first to avoid unnecessary API calls
        let isExpired = false;
        if (verifyExpiredAtRef.current) {
             const expireTime = new Date(verifyExpiredAtRef.current).getTime();
             if (Date.now() > expireTime) {
                 logInfo('video', 'Device code expired (local check). Regenerating...');
                 isExpired = true;
             }
        }

        if (isExpired) {
             // Clear settings immediately
             if ((window as any).electronAPI?.saveDeviceCode) {
                await (window as any).electronAPI.saveDeviceCode(null);
             }
             setDeviceCode(null);
             verifyExpiredAtRef.current = null;
             setTimeout(() => fetchStatus(), 100);
             return; // Exit, fetchStatus will run again
        }

        try {
          status = await cmsClient.getDeviceStatus(currentDeviceCode);
          processStatus(status);
        } catch (e: any) {
          // Handle 404 (Invalid Code)
          if (e.status === 404) {
             const timeSinceGeneration = Date.now() - lastGeneratedTimeRef.current;
             // Use 60 seconds (60000ms) to be extremely safe against slow propagation
             if (timeSinceGeneration > 60000) {
                 logInfo('video', 'Device status 404 (Invalid Code) and grace period passed. Regenerating.', { 
                     code: currentDeviceCode,
                     ageMs: timeSinceGeneration 
                 });
                 
                 // Clear settings immediately
                 if ((window as any).electronAPI?.saveDeviceCode) {
                    await (window as any).electronAPI.saveDeviceCode(null);
                 }
                 
                 // Clear state
                 setDeviceCode(null);
                 verifyExpiredAtRef.current = null;
                 
                 // Regenerate by calling fetchStatus recursively
                 setTimeout(() => fetchStatus(), 100);
             } else {
                 logInfo('video', 'Device status 404 but within grace period. Waiting.', {
                     code: currentDeviceCode,
                     ageMs: timeSinceGeneration
                 });
             }
          } else {
             logError('video', 'Failed to fetch device status', { error: e });
          }
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      if (isMountedRef.current) {
        logError('video', 'Failed to fetch CMS status', { error });
      }
    }
  }, [processStatus]);

  // Handle WebSocket events
  const handleWsSchedule = useCallback((data: any) => {
      logInfo('ws', 'Schedule update event received', data);
      fetchStatus();
  }, [fetchStatus]);

  const handleWsSystem = useCallback((data: any) => {
      logInfo('ws', 'System event received', data);
      const command = data?.command;
      if (command === 'restart') {
          (window as any).electronAPI?.restartApp();
      } else if (command === 'shutdown') {
          (window as any).electronAPI?.shutdownApp();
      }
  }, []);

  const handleWsAudio = useCallback((data: any) => {
      logInfo('ws', 'Audio event received', data);
      // Volume control to be implemented
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Check if we already have a Device ID to connect WS immediately
    const init = async () => {
        let savedId = null;
        if ((window as any).electronAPI?.getDeviceId) {
            savedId = await (window as any).electronAPI.getDeviceId();
        }
        
        if (savedId) {
            deviceIdRef.current = savedId;
            wsClient.connect(savedId);
        }

        // Initial fetch (REST) to get current content
        fetchStatus();
    };

    init();

    // Set up WS listeners
    wsClient.on('schedule', handleWsSchedule);
    wsClient.on('system', handleWsSystem);
    wsClient.on('audio', handleWsAudio);

    // Polling logic:
    // If NOT registered (no deviceId), poll frequently (30s)
    // If registered, we mainly rely on WS, but keep a slow poll (e.g. 10m) as backup? 
    // Or disable polling? User said "Polling until registered".
    // I will poll every 30s IF no deviceIdRef.current.
    
    pollingIntervalRef.current = setInterval(async () => {
        if (!deviceIdRef.current) {
            // Check expiry if we have a code but no ID (waiting for registration)
            if (verifyExpiredAtRef.current) {
                const expireTime = new Date(verifyExpiredAtRef.current).getTime();
                if (Date.now() > expireTime) {
                    logInfo('video', 'Device code expired. Regenerating...');
                    // Clear code to trigger regeneration in next fetchStatus
                    if ((window as any).electronAPI?.saveDeviceCode) {
                        await (window as any).electronAPI.saveDeviceCode(null);
                    }
                    setDeviceCode(null);
                    verifyExpiredAtRef.current = null;
                    fetchStatus();
                    return;
                }
            }
            fetchStatus();
        }
    }, 30000); // 30s polling for registration

    return () => {
      isMountedRef.current = false;
      wsClient.disconnect();
      wsClient.off('schedule', handleWsSchedule);
      wsClient.off('system', handleWsSystem);
      wsClient.off('audio', handleWsAudio);
      if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchStatus, handleWsSchedule, handleWsSystem, handleWsAudio]);

  return { asset, isLoading, deviceCode };
}
