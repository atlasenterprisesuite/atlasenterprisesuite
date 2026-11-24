import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraCaptureState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraCaptureState>('idle');
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('idle');
    setError('');
  }, []);

  const requestCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      setError('media_devices_unavailable');
      return false;
    }

    setState('requesting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setState('ready');
      return true;
    } catch (cause) {
      streamRef.current = null;
      const name = cause instanceof DOMException ? cause.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied');
        setError('camera_permission_denied');
      } else {
        setState('error');
        setError(cause instanceof Error ? cause.message : 'camera_request_failed');
      }
      return false;
    }
  }, []);

  useEffect(() => () => {
    const stream = streamRef.current;
    if (stream) for (const track of stream.getTracks()) track.stop();
    streamRef.current = null;
  }, []);

  return {
    videoRef,
    state,
    error,
    requestCamera,
    stopCamera,
    hasLiveStream: state === 'ready'
  };
}
