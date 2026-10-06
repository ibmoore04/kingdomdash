/**
 * Web Audio API synthesizer for Kitchen & Dispatch alerts without needing external MP3 files.
 * Implements mobile AudioContext autoplay gesture unlocking for iOS Safari and Android Chrome.
 */

let sharedAudioCtx: AudioContext | null = null;

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

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
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
 * Automatically attaches gesture listeners to the document
 * to opportunistically unlock audio on user interaction.
 * Listeners stay active until the AudioContext is verified running.
 */
export function registerAutoAudioUnlock(): void {
  if (typeof window === 'undefined') return;

  const handleInteraction = async () => {
    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (isAudioUnlocked()) {
        window.removeEventListener('pointerdown', handleInteraction);
        window.removeEventListener('touchstart', handleInteraction);
        window.removeEventListener('keydown', handleInteraction);
        window.removeEventListener('click', handleInteraction);
        window.removeEventListener('mousedown', handleInteraction);
      }
    } catch {
      // Ignored, will retry on next user gesture
    }
  };

  window.addEventListener('pointerdown', handleInteraction, { passive: true });
  window.addEventListener('touchstart', handleInteraction, { passive: true });
  window.addEventListener('keydown', handleInteraction, { passive: true });
  window.addEventListener('click', handleInteraction, { passive: true });
  window.addEventListener('mousedown', handleInteraction, { passive: true });
}

// Auto-register listener in browser environment and attach test helpers
if (typeof window !== 'undefined') {
  registerAutoAudioUnlock();
  const win = window as unknown as Record<string, unknown>;
  win.testChime = playNotificationChime;
  win.playChime = playNotificationChime;
  win.unlockAudio = unlockAudioContext;
}

/**
 * Synthesizes a two-tone high-visibility chime for Kitchen Order Alerts:
 * D5 (587.33 Hz) -> A5 (880 Hz)
 */
export async function playKitchenOrderChime(): Promise<void> {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (ctx.state !== 'running') {
      console.warn('[AudioChime] AudioContext is suspended. Tap the screen to enable audio.');
      return;
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.setValueAtTime(880, now + 0.14);

    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.setValueAtTime(1174.66, now + 0.14);

    const mult = getAudioVolumeMultiplier();
    gain.gain.setValueAtTime(0.5 * mult, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.75);
    osc2.stop(now + 0.75);
  } catch (err) {
    console.warn('[AudioChime] Kitchen chime playback unavailable:', err);
  }
}

/**
 * Synthesizes an energetic dispatch notification for Courier / Rider assignments:
 * G5 (783.99 Hz) -> C6 (1046.50 Hz)
 */
export async function playDispatchAlertChime(): Promise<void> {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (ctx.state !== 'running') {
      console.warn('[AudioChime] AudioContext is suspended. Tap the screen to enable audio.');
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(783.99, now);
    osc.frequency.setValueAtTime(1046.5, now + 0.1);

    const mult = getAudioVolumeMultiplier();
    gain.gain.setValueAtTime(0.55 * mult, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (err) {
    console.warn('[AudioChime] Dispatch chime playback unavailable:', err);
  }
}

/**
 * Synthesizes a low-pitch warning alert for PIN lockout or delivery issues:
 * Triple 220Hz square wave pulses.
 */
export async function playLockoutAlertBeep(): Promise<void> {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (ctx.state !== 'running') {
      console.warn('[AudioChime] AudioContext is suspended. Tap the screen to enable audio.');
      return;
    }

    const now = ctx.currentTime;
    const mult = getAudioVolumeMultiplier();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now + i * 0.15);

      gain.gain.setValueAtTime(0.4 * mult, now + i * 0.15);
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

const SOUND_ENABLED_STORAGE_KEY = 'kd_sound_alerts_enabled';
const SOUND_VOLUME_STORAGE_KEY = 'kd_sound_volume_level';
const HAPTICS_ENABLED_STORAGE_KEY = 'kd_haptics_enabled';

export type AudioVolumeLevel = 'low' | 'medium' | 'high';

/**
 * Checks if sound notifications are globally enabled by the user (default: true).
 */
export function isGlobalSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
  return stored !== 'false';
}

/**
 * Updates the user's global sound alert preference.
 */
export function setGlobalSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('kd:sound-preference-changed', { detail: { enabled } }));
}

/**
 * Returns the current alert volume level: 'low', 'medium', or 'high'.
 */
export function getAudioVolume(): AudioVolumeLevel {
  if (typeof window === 'undefined') return 'medium';
  const stored = localStorage.getItem(SOUND_VOLUME_STORAGE_KEY);
  if (stored === 'low' || stored === 'medium' || stored === 'high') {
    return stored;
  }
  return 'medium';
}

/**
 * Updates the alert volume level preference.
 */
export function setAudioVolume(level: AudioVolumeLevel): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_VOLUME_STORAGE_KEY, level);
  window.dispatchEvent(new CustomEvent('kd:sound-volume-changed', { detail: { level } }));
}

/**
 * Returns the linear gain multiplier based on current volume setting.
 */
export function getAudioVolumeMultiplier(): number {
  const vol = getAudioVolume();
  switch (vol) {
    case 'low':
      return 0.35;
    case 'high':
      return 1.0;
    case 'medium':
    default:
      return 0.7;
  }
}

/**
 * Checks if haptic vibration feedback is enabled (default: true).
 */
export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY);
  return stored !== 'false';
}

/**
 * Updates the mobile haptic vibration preference.
 */
export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HAPTICS_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('kd:haptics-preference-changed', { detail: { enabled } }));
}

/**
 * Triggers hardware vibration on supported mobile devices using the Web Vibration API.
 */
export function triggerHapticFeedback(
  pattern: 'info' | 'success' | 'warning' | 'error' | number[] = 'info'
): boolean {
  if (typeof window === 'undefined' || !isHapticsEnabled()) return false;
  if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') return false;

  try {
    let vibPattern: number[];
    if (Array.isArray(pattern)) {
      vibPattern = pattern;
    } else {
      switch (pattern) {
        case 'error':
          vibPattern = [250, 80, 250];
          break;
        case 'success':
          vibPattern = [120, 60, 150];
          break;
        case 'warning':
          vibPattern = [150, 70, 150];
          break;
        case 'info':
        default:
          vibPattern = [80, 50, 80];
          break;
      }
    }
    return navigator.vibrate(vibPattern);
  } catch {
    return false;
  }
}

/**
 * Plays the appropriate synthesized chime for any global notification or toast.
 * Also triggers mobile haptic feedback if enabled.
 */
export async function playNotificationChime(
  variant: 'info' | 'success' | 'warning' | 'error' = 'info'
): Promise<void> {
  // Trigger physical sensory feedback on mobile devices
  triggerHapticFeedback(variant);

  if (!isGlobalSoundEnabled()) return;

  if (variant === 'error') {
    await playLockoutAlertBeep();
  } else if (variant === 'success') {
    await playDispatchAlertChime();
  } else {
    await playKitchenOrderChime();
  }
}
