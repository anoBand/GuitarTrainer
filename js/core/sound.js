// js/core/sound.js

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
// 마스터 게인 노드 생성 (전체 볼륨 조절용)
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);
masterGain.gain.value = 0.5;

export const SoundManager = {
    // 볼륨 설정 메서드 (0.0 ~ 1.0)
    setVolume(value) {
        // 급격한 변화 시 팝 노이즈 방지를 위해 스무딩 적용
        masterGain.gain.setTargetAtTime(value, audioCtx.currentTime, 0.01);
    },

    playTone(freq, type, duration) {
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        // 개별 노트의 볼륨 엔벨로프
        gain.gain.setValueAtTime(1.0, audioCtx.currentTime); // 마스터 게인이 있으므로 여기선 1.0 기준
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(masterGain); // [중요] 마스터 게인으로 연결

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },

    playSuccess() {
        this.playTone(880, 'sine', 0.1);
        setTimeout(() => this.playTone(1108, 'sine', 0.4), 100);
    },

    playFail() {
        this.playTone(150, 'sawtooth', 0.3);
    },

    playGameOver() {
        this.playTone(523.25, 'triangle', 0.2);
        setTimeout(() => this.playTone(493.88, 'triangle', 0.2), 200);
        setTimeout(() => this.playTone(440.00, 'triangle', 0.4), 400);
    }
};