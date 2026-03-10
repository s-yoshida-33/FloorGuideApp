import React, { useEffect, useRef, forwardRef } from 'react';

interface OptimizedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export const OptimizedVideo = forwardRef<HTMLVideoElement, OptimizedVideoProps>(({ src, className, style, ...props }, ref) => {
  const innerRef = useRef<HTMLVideoElement>(null);
  
  // Synchronize external ref with internal ref
  useEffect(() => {
    if (!ref) return;
    
    if (typeof ref === 'function') {
      ref(innerRef.current);
    } else {
      (ref as React.MutableRefObject<HTMLVideoElement | null>).current = innerRef.current;
    }
  }, [ref]);

  // Handle src changes
  // Release decoded video frames before loading new src to prevent memory leak.
  // Without this, Chromium accumulates decoded frame buffers across src changes.
  const prevSrcRef = useRef<string>('');
  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;

    // Settings to reduce CPU load
    video.preload = 'metadata';

    // Guard: skip if src is empty to prevent black screen / error state
    if (!src) {
      prevSrcRef.current = src;
      return;
    }

    // If there is a previous source, release decoded frames before loading the new source
    if (prevSrcRef.current && prevSrcRef.current !== src) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      // Since useEffect runs after React's DOM update, removeAttribute('src') 
      // will remove the new src set by React. Explicitly set it again.
      video.src = src;
      video.load();
    }
    prevSrcRef.current = src;
  }, [src]);

  // Mount/unmount handling (cleanup only)
  useEffect(() => {
    const video = innerRef.current;
    if (!video) return;

    // Cleanup: execute only when the component is completely unmounted
    // * Use empty dependency array to prevent execution on src change
    return () => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load(); // Reset loading and completely stop playback
      } catch (e) {
        console.warn('Video cleanup failed:', e);
      }
    };
  }, []);
  
  return (
    <video
      ref={innerRef}
      src={src}
      className={className}
      style={style}
      loop
      autoPlay
      playsInline
      // Attributes to reduce CPU load
      disablePictureInPicture
      disableRemotePlayback
      {...props}
    />
  );
});

OptimizedVideo.displayName = 'OptimizedVideo';