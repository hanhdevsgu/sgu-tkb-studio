let sharedAudioCtx: AudioContext | null = null;

/**
 * Âm thanh báo hiệu Web Audio API tự nhiên, không phụ thuộc file tĩnh.
 * Tái sử dụng 1 AudioContext duy nhất để không vượt giới hạn trình duyệt khi săn nhiều môn.
 */
export function playSniperSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    const ctx = sharedAudioCtx;

    const play = () => {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Major arpeggio chime)
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.35, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.35);
      });
    };

    if (ctx.state !== 'running') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch {}
}

