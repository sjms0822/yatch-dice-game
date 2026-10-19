// Web Audio API Sound Synthesizer for Yacht Dice
class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initAudioContext = this.initAudioContext.bind(this);
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  initAudioContext() {
    this.init();
    window.removeEventListener('click', this.initAudioContext);
    window.removeEventListener('keydown', this.initAudioContext);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // 단단하고 매끄러운 플라스틱/아크릴 주사위 충돌 사운드
  playDiceHit(strength = 1.0) {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      const clampedStrength = Math.min(Math.max(strength, 0.15), 2.5);

      // 1. 플라스틱 표면의 매우 날카로운 순간 클릭 임팩트
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.018);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // 순간적인 샤프한 트랜지언트
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(3200 + Math.random() * 1000, now);
      noiseFilter.Q.setValueAtTime(6.0, now);

      // 2. 단단한 고밀도 플라스틱/레진 고유의 맑고 높은 공명음 ("딱!")
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const baseFreq = 1400 + Math.random() * 400; // 높은 플라스틱 고유 진동수
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.035);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.45 * clampedStrength, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      // 3. 플라스틱 주사위 특유의 보조 오버톤
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(baseFreq * 1.5, now);
      subOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.025);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.25 * clampedStrength, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      gain.gain.setValueAtTime(Math.min(clampedStrength * 0.5, 0.85), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noise.connect(noiseFilter);
      noiseFilter.connect(gain);
      osc.connect(oscGain);
      oscGain.connect(gain);
      subOsc.connect(subGain);
      subGain.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
      subOsc.start(now);
      subOsc.stop(now + 0.03);
    } catch (e) {
      // Audio fallback fail-safe
    }
  }

  // 주사위 투척음
  playRollThrow() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 스윙 사운드
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * (i / bufferSize));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.25);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.25);
    } catch (e) {}
  }

  // 주사위 킵 토글음
  playKeep(isKeeping = true) {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      const freq = isKeeping ? 587.33 : 440; // D5 or A4
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // 점수 확정 사운드
  playScoreSelect() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.2, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.22);
      });
    } catch (e) {}
  }

  // 요트 (Yacht, 50점) 달성 팡파르
  playYachtFanfare() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const chords = [
        { f: 523.25, t: 0 },    // C5
        { f: 659.25, t: 0.1 },  // E5
        { f: 783.99, t: 0.2 },  // G5
        { f: 1046.50, t: 0.3 }, // C6
        { f: 1318.51, t: 0.45 } // E6
      ];

      chords.forEach(({ f, t }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + t);

        gain.gain.setValueAtTime(0.35, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + t);
        osc.stop(now + t + 0.65);
      });
    } catch (e) {}
  }

  // 승리 사운드
  playVictory() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const melody = [
        { f: 440, d: 0.15 },
        { f: 554.37, d: 0.15 },
        { f: 659.25, d: 0.15 },
        { f: 880, d: 0.45 }
      ];
      let offset = 0;
      melody.forEach(m => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(m.f, now + offset);

        gain.gain.setValueAtTime(0.3, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + m.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + m.d);
        offset += m.d * 0.9;
      });
    } catch (e) {}
  }

  // 일반 버튼 클릭
  playClick() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }
}

export const sound = new SoundManager();
// 유저 첫 제스처 시 오디오 초기화
window.addEventListener('click', sound.initAudioContext, { once: true });
window.addEventListener('keydown', sound.initAudioContext, { once: true });
