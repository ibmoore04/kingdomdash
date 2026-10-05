/**
 * Web Audio API synthesizer for Kitchen & Dispatch alerts without needing external MP3 files.
 * Implements mobile AudioContext autoplay gesture unlocking for iOS Safari and Android Chrome.
 */

let sharedAudioCtx: AudioContext | null = null;
let isUnlockAttempted = false;

function getAudioContextClass(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  );
}

/**
 * Returns or creates the singleton AudioContext instance.
 */
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!sharedAudioCtx) {
    const AudioContextClass = getAudioContextClass();
    if (AudioContextClass) {
      try {
        sharedAudioCtx = new AudioContextClass();
      } catch (err) {
        console.warn('[AudioChime] Failed to instantiate AudioContext:', err);
      }
    }
  }

  return sharedAudioCtx;
}

/**
 * Checks whether the AudioContext is running and unblocked by the mobile browser.
 */
export function isAudioUnlocked(): boolean {
  const ctx = getSharedAudioContext();
  return Boolean(ctx && ctx.state === 'running');
}

/**
 * Explicitly unlocks the AudioContext during a user touch/click gesture.
 * Plays a 5ms silent tone to prime the audio hardware pipeline.
 */
export async function unlockAudioContext(): Promise<boolean> {
  const ctx = getSharedAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play a near-silent 5ms micro-tone to warm up mobile hardware decoder
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.005);

    return ctx.state === 'running';
  } catch (err) {
    console.warn('[AudioChime] Could not unlock AudioContext:', err);
    return false;
  }
}

/**
 * Automatically attaches passive gesture listeners to the document
 * to opportunistically unlock audio on first customer or vendor interaction.
 */
export function registerAutoAudioUnlock(): void {
  if (typeof window === 'undefined' || isUnlockAttempted) return;
  isUnlockAttempted = true;

  const handleInteraction = async () => {
    await unlockAudioContext();
    if (isAudioUnlocked()) {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    }
  };

  window.addEventListener('pointerdown', handleInteraction, { passive: true, once: true });
  window.addEventListener('touchstart', handleInteraction, { passive: true, once: true });
  window.addEventListener('keydown', handleInteraction, { passive: true, once: true });
}

// Auto-register listener in browser environment
if (typeof window !== 'undefined') {
  registerAutoAudioUnlock();
}

/**
 * Synthesizes a two-tone high-visibility chime for Kitchen Order Alerts:
 * D5 (587.33 Hz) -> A5 (880 Hz)
 */
export function playKitchenOrderChime(): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.14);

    osc2.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.75);
    osc2.stop(ctx.currentTime + 0.75);
  } catch (err) {
    console.warn('[AudioChime] Kitchen chime playback unavailable:', err);
  }
}

/**
 * Synthesizes an energetic dispatch notification for Courier / Rider assignments:
 * G5 (783.99 Hz) -> C6 (1046.50 Hz)
 */
export function playDispatchAlertChime(): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(783.99, ctx.currentTime);
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn('[AudioChime] Dispatch chime playback unavailable:', err);
  }
}

/**
 * Synthesizes a low-pitch warning alert for PIN lockout or delivery issues:
 * Triple 220Hz square wave pulses.
 */
export function playLockoutAlertBeep(): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now + i * 0.15);

      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.1);
    }
  } catch (err) {
    console.warn('[AudioChime] Lockout beep playback unavailable:', err);
  }
}
