import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useAudioRecorder() {
  const [state, setState] = useState('idle'); // idle, recording, paused, stopped
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [error, setError] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [speechSupported] = useState(!!SpeechRecognition);

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedDuration = useRef(0);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  // Enumerate mic devices
  useEffect(() => {
    async function getDevices() {
      try {
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

  // Start browser speech recognition
  const startSpeechRecognition = useCallback(() => {
    if (!SpeechRecognition) return;
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      finalTranscriptRef.current = '';
      setLiveTranscript('');
      setInterimText('');

      recognition.onresult = (event) => {
        let interim = '';
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        if (finalChunk) {
          finalTranscriptRef.current += finalChunk;
          setLiveTranscript(finalTranscriptRef.current.trim());
        }
        setInterimText(interim);
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.warn('Speech recognition error:', event.error);
      };

      // Auto-restart on end (browser stops after silence)
      recognition.onend = () => {
        if (recognitionRef.current && (state === 'recording')) {
          try { recognition.start(); } catch (e) { /* already started */ }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition failed to start:', e);
    }
  }, [state]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null; // prevent auto-restart
      try { ref.stop(); } catch (e) { /* already stopped */ }
    }
    setInterimText('');
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

      recorder.start(1000);
      setState('recording');
      startTimeRef.current = Date.now();
      pausedDuration.current = 0;
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current - pausedDuration.current) / 1000));
      }, 200);

      startLevelMeter(stream);
      startSpeechRecognition();
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Microphone permission denied' : `Recording error: ${e.message}`);
    }
  }, [selectedDevice, startLevelMeter, startSpeechRecognition]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.pause();
      setState('paused');
      pausedDuration.current -= Date.now();
      stopLevelMeter();
      stopSpeechRecognition();
    }
  }, [stopLevelMeter, stopSpeechRecognition]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorder.current?.state === 'paused') {
      mediaRecorder.current.resume();
      setState('recording');
      pausedDuration.current += Date.now();
      if (streamRef.current) startLevelMeter(streamRef.current);
      startSpeechRecognition();
    }
  }, [startLevelMeter, startSpeechRecognition]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      stopSpeechRecognition();
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
  }, [stopLevelMeter, stopSpeechRecognition]);

  const clearRecording = useCallback(() => {
    audioChunks.current = [];
    setState('idle');
    setDuration(0);
    setLiveTranscript('');
    setInterimText('');
    finalTranscriptRef.current = '';
    clearInterval(timerRef.current);
    stopLevelMeter();
    stopSpeechRecognition();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, [stopLevelMeter, stopSpeechRecognition]);

  const getAudioBlob = useCallback(() => {
    if (audioChunks.current.length === 0) return null;
    return new Blob(audioChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopLevelMeter();
      stopSpeechRecognition();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [stopLevelMeter, stopSpeechRecognition]);

  return {
    state, duration, audioLevel, devices, selectedDevice, error,
    liveTranscript, interimText, speechSupported,
    setSelectedDevice, startRecording, pauseRecording, resumeRecording,
    stopRecording, clearRecording, getAudioBlob,
  };
}
