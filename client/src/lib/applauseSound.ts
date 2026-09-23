/**
 * Web Audio API Celebratory Crowd Applause & Fanfare Synthesizer
 * 100% Offline, Zero external asset downloads, Works on all modern browsers & mobile devices.
 * Uses persistent AudioContext pre-warming so sounds play automatically without browser autoplay blocks.
 */

let sharedAudioCtx: AudioContext | null = null;
let activeGainNode: GainNode | null = null;
let activeStopTimeout: any = null;
let isPlaying = false;

/**
 * Returns or initializes the shared AudioContext without ever closing it,
 * preserving user-interaction authorization across the entire session.
 */
export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtxClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch (err) {
    console.warn('[AudioContext] Could not create audio context:', err);
    return null;
  }
}

/**
 * Pre-warms the AudioContext on any user gesture (tap, click, keydown),
 * ensuring the browser permits automatic audio playback when trophies pop.
 */
export function unlockAudioContext(): void {
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch {}
}

// Auto-register touch/click listeners to pre-warm audio context on first player interaction
if (typeof window !== 'undefined') {
  const handleUserGesture = () => {
    unlockAudioContext();
  };

  ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach((evtName) => {
    try {
      window.addEventListener(evtName, handleUserGesture, { capture: true, passive: true });
    } catch {}
  });
}

/**
 * Plays the victorious trophy pop sound:
 * 1. Immediate punchy trophy "pop & whoosh" sound effect
 * 2. Triumphant brass fanfare chords (C5, E5, G5, High C6)
 * 3. Roaring stadium crowd applause & celebratory cheering
 */
export function playApplauseSound(durationSeconds = 7): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return () => {};

    // If context is suspended, actively resume
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Smoothly disconnect previous gain if already playing, without closing context
    if (activeGainNode) {
      try {
        activeGainNode.gain.cancelScheduledValues(ctx.currentTime);
        activeGainNode.gain.setValueAtTime(activeGainNode.gain.value, ctx.currentTime);
        activeGainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      } catch {}
    }
    if (activeStopTimeout) {
      clearTimeout(activeStopTimeout);
      activeStopTimeout = null;
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, ctx.currentTime);
    masterGain.connect(ctx.destination);
    activeGainNode = masterGain;
    isPlaying = true;

    // --- 0. TROPHY "POP & WHOOSH" IMPACT SOUND ---
    // A crisp ascending sweep giving an immediate audible tactile "pop" as the trophy bursts onto screen
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(180, ctx.currentTime);
    popOsc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    popGain.gain.setValueAtTime(0.001, ctx.currentTime);
    popGain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    popGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    popOsc.connect(popGain);
    popGain.connect(masterGain);
    popOsc.start(ctx.currentTime);
    popOsc.stop(ctx.currentTime + 0.28);

    // --- 1. TRIUMPHANT VICTORY FANFARE (Bold Brass Chords: C5, E5, G5, C6) ---
    const fanfareNotes = [
      { freq: 523.25, time: 0.02, dur: 0.5, gain: 0.22 }, // C5
      { freq: 659.25, time: 0.14, dur: 0.5, gain: 0.24 }, // E5
      { freq: 783.99, time: 0.28, dur: 0.7, gain: 0.26 }, // G5
      { freq: 1046.50, time: 0.44, dur: 2.4, gain: 0.35 }, // C6 (High sustained triumph)
      { freq: 783.99, time: 0.44, dur: 2.2, gain: 0.25 }, // G5 (Harmony)
      { freq: 523.25, time: 0.44, dur: 2.2, gain: 0.22 }, // C5 (Bass foundation)
      { freq: 392.00, time: 0.44, dur: 2.0, gain: 0.18 }  // G4 (Low richness)
    ];

    fanfareNotes.forEach(({ freq, time, dur, gain: notePeakGain }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      noteGain.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      noteGain.gain.exponentialRampToValueAtTime(notePeakGain, ctx.currentTime + time + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + 0.1);
    });

    // --- 2. CROWD APPLAUSE & STADIUM CHEERING SYNTHESIS ---
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
    bandpass1.Q.setValueAtTime(2.0, ctx.currentTime);

    const bandpass2 = ctx.createBiquadFilter();
    bandpass2.type = 'bandpass';
    bandpass2.frequency.setValueAtTime(2400, ctx.currentTime);
    bandpass2.Q.setValueAtTime(2.6, ctx.currentTime);

    const applauseGain = ctx.createGain();
    applauseGain.gain.setValueAtTime(0.001, ctx.currentTime);
    applauseGain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.35);
    applauseGain.gain.setValueAtTime(0.4, ctx.currentTime + durationSeconds - 1.2);
    applauseGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSeconds);

    noiseNode.connect(bandpass1);
    noiseNode.connect(bandpass2);
    bandpass1.connect(applauseGain);
    bandpass2.connect(applauseGain);
    applauseGain.connect(masterGain);

    noiseNode.start(ctx.currentTime + 0.1);
    noiseNode.stop(ctx.currentTime + durationSeconds);

    // --- 3. INDIVIDUAL CRISP HAND CLAPS ---
    const clapIntervals = 40;
    for (let c = 0; c < clapIntervals; c++) {
      const clapTime = ctx.currentTime + 0.25 + Math.random() * (durationSeconds - 0.7);
      const clapOsc = ctx.createBufferSource();
      const clapBuf = ctx.createBuffer(1, Math.floor(sampleRate * 0.025), sampleRate);
      const clapData = clapBuf.getChannelData(0);
      for (let j = 0; j < clapData.length; j++) {
        clapData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (sampleRate * 0.004));
      }
      clapOsc.buffer = clapBuf;

      const clapFilter = ctx.createBiquadFilter();
      clapFilter.type = 'highpass';
      clapFilter.frequency.setValueAtTime(950 + Math.random() * 600, clapTime);

      const individualGain = ctx.createGain();
      individualGain.gain.setValueAtTime(0.14 + Math.random() * 0.1, clapTime);

      clapOsc.connect(clapFilter);
      clapFilter.connect(individualGain);
      individualGain.connect(masterGain);

      clapOsc.start(clapTime);
      clapOsc.stop(clapTime + 0.05);
    }

    activeStopTimeout = setTimeout(() => {
      stopApplauseSound();
    }, (durationSeconds + 0.5) * 1000);

    return () => {
      if (activeStopTimeout) {
        clearTimeout(activeStopTimeout);
        activeStopTimeout = null;
      }
      stopApplauseSound();
    };
  } catch (err) {
    console.warn('[ApplauseSound] Web Audio synthesis failed:', err);
    return () => {};
  }
}

export function stopApplauseSound(): void {
  const ctx = sharedAudioCtx;
  const gain = activeGainNode;
  if (gain && ctx && ctx.state !== 'closed') {
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      setTimeout(() => {
        try {
          gain.disconnect();
        } catch {}
        if (activeGainNode === gain) {
          activeGainNode = null;
        }
        isPlaying = false;
      }, 160);
    } catch {
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
