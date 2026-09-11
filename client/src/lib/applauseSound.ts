/**
 * Web Audio API Celebratory Crowd Applause & Fanfare Synthesizer
 * 100% Offline, Zero external asset downloads, Works on all modern browsers & mobile devices.
 */

let activeAudioCtx: AudioContext | null = null;
let activeGainNode: GainNode | null = null;
let isPlaying = false;

export function playApplauseSound(durationSeconds = 6): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return () => {};

    if (activeAudioCtx && activeAudioCtx.state !== 'closed') {
      try {
        activeAudioCtx.close();
      } catch {}
    }

    const ctx = new AudioCtxClass();
    activeAudioCtx = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
    masterGain.connect(ctx.destination);
    activeGainNode = masterGain;
    isPlaying = true;

    // --- 1. TRIUMPHANT FANFARE CHORDS (C Major Chord: C5, E5, G5, C6) ---
    const fanfareNotes = [
      { freq: 523.25, time: 0.0, dur: 0.6 }, // C5
      { freq: 659.25, time: 0.15, dur: 0.6 }, // E5
      { freq: 783.99, time: 0.3, dur: 0.8 }, // G5
      { freq: 1046.50, time: 0.5, dur: 2.0 }, // C6 (High sustained triumph)
      { freq: 783.99, time: 0.5, dur: 1.8 }, // G5
      { freq: 523.25, time: 0.5, dur: 1.8 }  // C5
    ];

    fanfareNotes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      noteGain.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      noteGain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + time + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.1);
    });

    // --- 2. CROWD APPLAUSE & CHEERING SYNTHESIS ---
    const sampleRate = ctx.sampleRate;
    const bufferLength = sampleRate * Math.min(durationSeconds, 8);
    const noiseBuffer = ctx.createBuffer(1, bufferLength, sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferLength; i++) {
      output[i] = (Math.random() * 2 - 1);
    }

    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;

    const bandpass1 = ctx.createBiquadFilter();
    bandpass1.type = 'bandpass';
    bandpass1.frequency.setValueAtTime(1100, ctx.currentTime);
    bandpass1.Q.setValueAtTime(2.2, ctx.currentTime);

    const bandpass2 = ctx.createBiquadFilter();
    bandpass2.type = 'bandpass';
    bandpass2.frequency.setValueAtTime(2200, ctx.currentTime);
    bandpass2.Q.setValueAtTime(2.8, ctx.currentTime);

    const applauseGain = ctx.createGain();
    applauseGain.gain.setValueAtTime(0.001, ctx.currentTime);
    applauseGain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.4);
    applauseGain.gain.setValueAtTime(0.35, ctx.currentTime + durationSeconds - 1.2);
    applauseGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSeconds);

    noiseNode.connect(bandpass1);
    noiseNode.connect(bandpass2);
    bandpass1.connect(applauseGain);
    bandpass2.connect(applauseGain);
    applauseGain.connect(masterGain);

    noiseNode.start(ctx.currentTime + 0.2);
    noiseNode.stop(ctx.currentTime + durationSeconds);

    // Individual simulated sharp hand claps
    const clapIntervals = 35;
    for (let c = 0; c < clapIntervals; c++) {
      const clapTime = ctx.currentTime + 0.3 + Math.random() * (durationSeconds - 0.8);
      const clapOsc = ctx.createBufferSource();
      const clapBuf = ctx.createBuffer(1, Math.floor(sampleRate * 0.025), sampleRate);
      const clapData = clapBuf.getChannelData(0);
      for (let j = 0; j < clapData.length; j++) {
        clapData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (sampleRate * 0.004));
      }
      clapOsc.buffer = clapBuf;

      const clapFilter = ctx.createBiquadFilter();
      clapFilter.type = 'highpass';
      clapFilter.frequency.setValueAtTime(900 + Math.random() * 600, clapTime);

      const individualGain = ctx.createGain();
      individualGain.gain.setValueAtTime(0.12 + Math.random() * 0.1, clapTime);

      clapOsc.connect(clapFilter);
      clapFilter.connect(individualGain);
      individualGain.connect(masterGain);

      clapOsc.start(clapTime);
      clapOsc.stop(clapTime + 0.05);
    }

    const timer = setTimeout(() => {
      stopApplauseSound();
    }, (durationSeconds + 0.5) * 1000);

    return () => {
      clearTimeout(timer);
      stopApplauseSound();
    };
  } catch (err) {
    console.warn('Web Audio applause generation not supported or blocked:', err);
    return () => {};
  }
}

export function stopApplauseSound(): void {
  const ctx = activeAudioCtx;
  const gain = activeGainNode;
  if (gain && ctx && (ctx.state as string) !== 'closed') {
    try {
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      setTimeout(() => {
        try {
          if ((ctx.state as string) !== 'closed') {
            ctx.close().catch(() => {});
          }
        } catch {}
        activeAudioCtx = null;
        activeGainNode = null;
        isPlaying = false;
      }, 200);
    } catch {
      try {
        if ((ctx.state as string) !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch {}
      activeAudioCtx = null;
      activeGainNode = null;
      isPlaying = false;
    }
  } else {
    isPlaying = false;
  }
}

export function isApplausePlaying(): boolean {
  return isPlaying;
}
