import { Howl, Howler } from 'howler';

type AudioPrefs = {
  masterVolume: number;
  bgmEnabled: boolean;
  bgmVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
};

type SoundKey =
  | 'click'
  | 'win_small'
  | 'win_big'
  | 'bet'
  | 'slot_reel'
  | 'slot_stop'
  | 'crash_engine'
  | 'crash_explosion'
  | 'bgm_lobby'
  | 'bgm_casino'
  | 'bgm_tense';

declare global {
  interface Window {
    __deviceLinkerAudioManager?: AudioManager;
  }
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

class AudioManager {
  private sounds: Partial<Record<SoundKey, Howl>> = {};
  private currentBgmKey = '';
  private currentBgmId: number | null = null;
  private pendingBgmKey = '';
  private initialized = false;
  private gestureBound = false;
  private clickBound = false;
  private userInteracted = false;
  private bgmDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private state: AudioPrefs = {
    masterVolume: 0.7,
    bgmEnabled: true,
    bgmVolume: 0.45,
    sfxEnabled: true,
    sfxVolume: 0.75,
  };

  private soundConfig: Record<Exclude<SoundKey, `bgm_${string}`>, string> = {
    click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    win_small: 'https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3',
    win_big: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
    bet: 'https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3',
    slot_reel: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
    slot_stop: 'https://assets.mixkit.co/active_storage/sfx/2021/2021-preview.mp3',
    crash_engine: 'https://assets.mixkit.co/active_storage/sfx/2022/2022-preview.mp3',
    crash_explosion: 'https://assets.mixkit.co/active_storage/sfx/2023/2023-preview.mp3',
  };

  private bgmConfig: Record<Extract<SoundKey, `bgm_${string}`>, string> = {
    bgm_lobby: '/audio/SoundHelix-Song-1.mp3',
    bgm_casino: '/audio/SoundHelix-Song-2.mp3',
    bgm_tense: '/audio/SoundHelix-Song-3.mp3',
  };

  private isBgmKey(key: string): key is Extract<SoundKey, `bgm_${string}`> {
    return key.startsWith('bgm_');
  }

  private getEffectiveVolume(key: SoundKey, overrideVolume?: number): number {
    const base = this.isBgmKey(key) ? this.state.bgmVolume : this.state.sfxVolume;
    const withMaster = clamp(base) * clamp(this.state.masterVolume);
    if (typeof overrideVolume === 'number') return clamp(overrideVolume) * withMaster;
    return withMaster;
  }

  private isMuted(key: SoundKey): boolean {
    if (this.state.masterVolume <= 0) return true;
    if (this.isBgmKey(key)) return !this.state.bgmEnabled || this.state.bgmVolume <= 0;
    return !this.state.sfxEnabled || this.state.sfxVolume <= 0;
  }

  private resumeAudioContext() {
    const ctx = Howler.ctx as AudioContext | undefined;
    if (!ctx || typeof ctx.resume !== 'function' || ctx.state === 'running') return;
    void ctx.resume();
  }

  init() {
    if (typeof window === 'undefined') return;
    this.bindGestureUnlock();
    this.bindGlobalClickSound();
    if (this.initialized) return;

    Howler.autoUnlock = true;
    if (typeof Howler.html5PoolSize === 'number' && Howler.html5PoolSize < 24) {
      Howler.html5PoolSize = 24;
    }

    this.initialized = true;
    // Don't preload all SFX on init — lazy-load on play instead
    this.applyAllSoundStates();
  }

  destroy() {
    this.stopBGM();
    if (this.bgmDebounceTimer) clearTimeout(this.bgmDebounceTimer);
    if (this.clickBound && typeof document !== 'undefined') {
      document.removeEventListener('click', this.handleGlobalClick);
      this.clickBound = false;
    }
    Object.keys(this.sounds).forEach((key) => {
      const s = this.sounds[key as SoundKey];
      if (s) s.unload();
      delete this.sounds[key as SoundKey];
    });
    this.initialized = false;
    if (typeof window !== 'undefined') {
      delete window.__deviceLinkerAudioManager;
    }
  }

  private preloadSfx() {
    (Object.keys(this.soundConfig) as Array<Exclude<SoundKey, `bgm_${string}`>>).forEach((key) => {
      this.ensureSound(key);
    });
  }

  private bindGestureUnlock() {
    if (this.gestureBound || typeof window === 'undefined') return;
    this.gestureBound = true;

    const unlock = () => {
      this.userInteracted = true;
      this.init();
      this.resumeAudioContext();
      if (this.pendingBgmKey && this.state.bgmEnabled) {
        this.playBGM(this.pendingBgmKey);
      }
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
  }

  private handleGlobalClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest('button, a, [role="button"], input[type="range"], select');
    if (!interactive) return;
    this.play('click', { volume: 0.6 });
  };

  private bindGlobalClickSound() {
    if (this.clickBound || typeof document === 'undefined') return;
    this.clickBound = true;
    document.addEventListener('click', this.handleGlobalClick);
  }

  private retryPlay(sound: Howl, retries = 3, delay = 500): Promise<number | null> {
    return new Promise((resolve) => {
      const attempt = (remaining: number) => {
        this.resumeAudioContext();
        const id = sound.play();
        if (id !== -1) {
          resolve(id);
          return;
        }
        if (remaining <= 0) {
          console.warn(`[Audio] play failed after ${retries} retries`);
          resolve(null);
          return;
        }
        setTimeout(() => attempt(remaining - 1), delay);
      };
      attempt(retries);
    });
  }

  private ensureSound(key: SoundKey) {
    if (this.sounds[key]) return this.sounds[key] || null;

    const src = this.isBgmKey(key) ? this.bgmConfig[key] : this.soundConfig[key];
    const isBgm = this.isBgmKey(key);

    const sound = new Howl({
      src: [src],
      html5: isBgm,
      preload: true,
      mute: this.isMuted(key),
      volume: this.getEffectiveVolume(key),
      onend: isBgm ? () => {
        if (this.currentBgmKey !== key) return;
        this.resumeAudioContext();
        this.retryPlay(sound).then((id) => {
          if (id !== null) this.currentBgmId = id;
        });
      } : undefined,
      onloaderror: (_id, err) => {
        console.warn(`[Audio] load error for ${key}:`, err);
      },
      onplayerror: (_id, err) => {
        console.warn(`[Audio] play error for ${key}:`, err);
        this.resumeAudioContext();
      },
    });

    this.sounds[key] = sound;
    return sound;
  }

  private applySoundState(key: SoundKey) {
    const sound = this.sounds[key];
    if (!sound) return;
    sound.mute(this.isMuted(key));
    sound.volume(this.getEffectiveVolume(key));
  }

  private applyAllSoundStates() {
    (Object.keys(this.sounds) as SoundKey[]).forEach((key) => this.applySoundState(key));
  }

  private normalizeBgmKey(trackName?: string): Extract<SoundKey, `bgm_${string}`> {
    const raw = String(trackName || '').trim().toLowerCase();
    if (!raw) return 'bgm_lobby';
    if (raw in this.bgmConfig) return raw as Extract<SoundKey, `bgm_${string}`>;
    const prefixed = raw.startsWith('bgm_') ? raw : `bgm_${raw}`;
    if (prefixed in this.bgmConfig) return prefixed as Extract<SoundKey, `bgm_${string}`>;
    return 'bgm_lobby';
  }

  play(key: SoundKey, options?: { loop?: boolean; volume?: number }): number | null {
    this.init();
    if (this.isBgmKey(key)) return null;

    if (!this.userInteracted) return null;

    const sound = this.ensureSound(key);
    if (!sound || this.isMuted(key)) return null;

    this.resumeAudioContext();
    sound.loop(Boolean(options?.loop));
    sound.mute(this.isMuted(key));
    sound.volume(this.getEffectiveVolume(key, options?.volume));
    const id = sound.play();
    if (this.isBgmKey(key)) {
      this.currentBgmKey = key;
      this.currentBgmId = id;
    }
    return id;
  }

  stop(key: SoundKey, id?: number | null) {
    const sound = this.sounds[key];
    if (!sound) return;
    if (id && id !== -1) sound.stop(id);

    if (this.isBgmKey(key) && this.currentBgmKey === key && (!id || this.currentBgmId === id)) {
      this.currentBgmId = null;
    }
  }

  playBGM(trackName?: string): number | null {
    const key = this.normalizeBgmKey(trackName);
    this.pendingBgmKey = key;
    this.init();

    if (!this.userInteracted) return null;
    if (this.isMuted(key)) return null;

    // Debounce: if same key requested within 300ms, skip
    if (this.bgmDebounceTimer) {
      clearTimeout(this.bgmDebounceTimer);
    }
    this.bgmDebounceTimer = setTimeout(() => {
      this.bgmDebounceTimer = null;
    }, 300);

    this.resumeAudioContext();

    if (this.currentBgmKey === key && this.currentBgmId) {
      this.applySoundState(key);
      return this.currentBgmId;
    }

    // Ensure the old BGM is fully stopped before starting new one
    if (this.currentBgmKey && this.currentBgmKey !== key) {
      const oldSound = this.sounds[this.currentBgmKey as SoundKey];
      if (oldSound) {
        oldSound.stop();
      }
      this.currentBgmKey = '';
      this.currentBgmId = null;
    }

    const sound = this.ensureSound(key);
    if (!sound) return null;

    sound.loop(true);
    sound.mute(this.isMuted(key));
    sound.volume(this.getEffectiveVolume(key, 1));
    const id = sound.play();
    if (id === -1) {
      console.warn(`[Audio] playBGM failed for ${key}`);
      return null;
    }
    this.currentBgmKey = key;
    this.currentBgmId = id;
    return id;
  }

  stopBGM() {
    if (!this.currentBgmKey) return;
    this.stop(this.currentBgmKey as SoundKey, this.currentBgmId);
    this.currentBgmKey = '';
    this.currentBgmId = null;
  }

  setPreferences(prefs: Partial<AudioPrefs>) {
    if (typeof prefs.masterVolume === 'number') this.state.masterVolume = clamp(prefs.masterVolume);
    if (typeof prefs.bgmEnabled === 'boolean') this.state.bgmEnabled = prefs.bgmEnabled;
    if (typeof prefs.bgmVolume === 'number') this.state.bgmVolume = clamp(prefs.bgmVolume);
    if (typeof prefs.sfxEnabled === 'boolean') this.state.sfxEnabled = prefs.sfxEnabled;
    if (typeof prefs.sfxVolume === 'number') this.state.sfxVolume = clamp(prefs.sfxVolume);

    this.applyAllSoundStates();

    if (!this.state.bgmEnabled || this.state.masterVolume <= 0 || this.state.bgmVolume <= 0) {
      this.stopBGM();
    } else if (this.pendingBgmKey && this.userInteracted) {
      this.playBGM(this.pendingBgmKey);
    }
  }
}

function getAudioManager(): AudioManager {
  if (typeof window === 'undefined') return new AudioManager();
  if (!window.__deviceLinkerAudioManager) {
    window.__deviceLinkerAudioManager = new AudioManager();
  }
  return window.__deviceLinkerAudioManager;
}

const audioApi = {
  init: () => getAudioManager().init(),
  destroy: () => getAudioManager().destroy(),
  play: (name: SoundKey, options?: { loop?: boolean; volume?: number }) => getAudioManager().play(name, options),
  playBGM: (trackName?: string) => getAudioManager().playBGM(trackName),
  stopBGM: () => getAudioManager().stopBGM(),
  setPreferences: (prefs: Partial<AudioPrefs>) => getAudioManager().setPreferences(prefs),
};

export const useAudio = () => audioApi;
