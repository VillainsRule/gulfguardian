let bgMusic: HTMLAudioElement | null = null;
let started = false;
let musicMuted = false;

const MUSIC_VOLUME = 0.4;

export function initMusic(): void {
  if (bgMusic) return;
  bgMusic = new Audio('/audio/music_loop.ogg');
  bgMusic.loop = true;
  bgMusic.volume = musicMuted ? 0 : MUSIC_VOLUME;
}

export function setMusicMuted(muted: boolean): void {
  musicMuted = muted;
  if (bgMusic) {
    bgMusic.volume = muted ? 0 : MUSIC_VOLUME;
  }
}

export function isMusicMuted(): boolean {
  return musicMuted;
}

export function startMusic(): void {
  if (started) return;
  initMusic();
  if (bgMusic) {
    bgMusic.play()
      .then(() => {
        started = true;
      })
      .catch(() => {
        started = false;
      });
  }
}

export function stopMusic(): void {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    started = false;
  }
}
