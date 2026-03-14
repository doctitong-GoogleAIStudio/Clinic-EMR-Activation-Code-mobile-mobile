import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioRecorder() {
  const [state, setState] = useState('idle'); // idle, recording, paused, stopped
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [error, setError] = useState(null);

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedDuration = useRef(0);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Enumerate mic devices
  useEffect(() => {
    async function getDevices() {
      try {
        // Request permission first to get labeled devices
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const all = await navigator.mediaDevices.enumerateDevices();
        const mics = all.filter(d => d.kind === 'audioinput');
        setDevices(mics);
        if (mics.length > 0 && !selectedDevice) setSelectedDevice(mics[0].deviceId);
      } catch (e) {
        setError('Microphone access denied');
      }
    }
    getDevices();
  }, []);

  const startLevelMeter = useCallback((stream) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = { ctx, analyser };
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(Math.min(avg / 128, 1));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (analyserRef.current?.ctx) {
      analyserRef.current.ctx.close().catch(() => {});
      analyserRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    audioChunks.current = [];
    try {
      const constraints = { audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.start(1000); // collect data every 1s for chunking
      setState('recording');
      startTimeRef.current = Date.now();
      pausedDuration.current = 0;
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current - pausedDuration.current) / 1000));
      }, 200);

      startLevelMeter(stream);
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Microphone permission denied' : `Recording error: ${e.message}`);
    }
  }, [selectedDevice, startLevelMeter]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.pause();
      setState('paused');
      pausedDuration.current -= Date.now(); // mark pause start (negative)
      stopLevelMeter();
    }
  }, [stopLevelMeter]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorder.current?.state === 'paused') {
      mediaRecorder.current.resume();
      setState('recording');
      pausedDuration.current += Date.now(); // calculate paused time
      if (streamRef.current) startLevelMeter(streamRef.current);
    }
  }, [startLevelMeter]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') {
        resolve(null);
        return;
      }
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: mediaRecorder.current.mimeType || 'audio/webm' });
        setState('stopped');
        clearInterval(timerRef.current);
        stopLevelMeter();
        streamRef.current?.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      mediaRecorder.current.stop();
    });
  }, [stopLevelMeter]);

  const clearRecording = useCallback(() => {
    audioChunks.current = [];
    setState('idle');
    setDuration(0);
    clearInterval(timerRef.current);
    stopLevelMeter();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, [stopLevelMeter]);

  // Get current audio blob without stopping
  const getAudioBlob = useCallback(() => {
    if (audioChunks.current.length === 0) return null;
    return new Blob(audioChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopLevelMeter();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [stopLevelMeter]);

  return {
    state, duration, audioLevel, devices, selectedDevice, error,
    setSelectedDevice, startRecording, pauseRecording, resumeRecording,
    stopRecording, clearRecording, getAudioBlob,
  };
}
