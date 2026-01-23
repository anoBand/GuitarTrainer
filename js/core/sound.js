// js/core/sound.js

export const SoundManager = {
    audioContext: null,
    masterGain: null, // 볼륨 조절용 메인 게인 노드

    // 샘플링 관련 변수
    guitarBuffer: null,
    BASE_GUITAR_FREQ: 110.00, // [수정] A2(라) 주파수로 변경 (5번줄 개방현 음정)
    SAMPLE_URL: 'assets/sounds/guitar_a2.mp3', // [수정] A2 샘플 파일 경로로 변경

    init() {
        // 1. AudioContext가 없으면 생성
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // 2. MasterGain이 없으면 생성
        if (!this.masterGain) {
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.5; // 기본 볼륨 50%
            this.masterGain.connect(this.audioContext.destination);

            // 초기화 시 샘플 로드 시도
            this.loadGuitarSample();
        }

        // 3. Suspended 상태라면 재개
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    },

    // 오디오 파일 로드 및 디코딩
    async loadGuitarSample() {
        if (this.guitarBuffer) return; // 이미 로드됨

        try {
            const response = await fetch(this.SAMPLE_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();
            this.guitarBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log("🎸 Guitar sample (A2) loaded successfully.");
        } catch (error) {
            console.warn("⚠️ Guitar sample load failed/skipped. Using synthesizer fallback.");
        }
    },

    setVolume(value) {
        this.init(); // 안전하게 초기화 확인
        const vol = Math.max(0, Math.min(1, value));
        this.masterGain.gain.value = vol;
    },

    // 샘플링 기반 재생 (실패 시 합성음 사용)
    playGuitarTone(frequency, duration = 1.5) {
        // [Safety Check] 유효하지 않은 주파수 방지
        if (!Number.isFinite(frequency) || frequency <= 0) return;

        this.init(); // 초기화 보장

        // 1. 샘플이 준비되었다면: 피치 시프팅 방식으로 재생
        if (this.guitarBuffer) {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.guitarBuffer;

            // Pitch Shifting: A2(110Hz) 기준 비율 계산
            const rate = frequency / this.BASE_GUITAR_FREQ;

            if (Number.isFinite(rate) && rate > 0) {
                source.playbackRate.value = rate;

                const gainNode = this.audioContext.createGain();
                const t = this.audioContext.currentTime;

                gainNode.gain.setValueAtTime(1, t);
                gainNode.gain.exponentialRampToValueAtTime(0.01, t + duration);

                source.connect(gainNode);
                gainNode.connect(this.masterGain);

                source.start(t);
                source.stop(t + duration + 0.1);
            }
        }
        // 2. 샘플이 없다면: 기존 합성음 방식 사용 (Fallback)
        else {
            this.playSynthesizedGuitar(frequency, duration);
            this.loadGuitarSample(); // 재시도
        }
    },

    // 기존 playGuitarTone 로직 (백업용)
    playSynthesizedGuitar(frequency, duration) {
        if (!Number.isFinite(frequency) || frequency <= 0) return;

        const t = this.audioContext.currentTime;

        const osc = this.audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = frequency;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(frequency * 4, t);
        filter.frequency.exponentialRampToValueAtTime(frequency, t + 0.1);

        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(1, t + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(filter);
        filter.connect(gainNode);

        if (this.masterGain) {
            gainNode.connect(this.masterGain);
        } else {
            gainNode.connect(this.audioContext.destination);
        }

        osc.start(t);
        osc.stop(t + duration);
    },

    playTone(frequency, type = 'sine', duration = 0.3, detune = 0) {
        if (!Number.isFinite(frequency)) return;

        this.init();

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = frequency;
        if (detune) osc.detune.value = detune;

        osc.connect(gainNode);

        if (this.masterGain) {
            gainNode.connect(this.masterGain);
        } else {
            gainNode.connect(this.audioContext.destination);
        }

        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    },

    playSuccess() {
        this.playTone(523.25, 'sine', 0.1); // C5
        setTimeout(() => this.playTone(659.25, 'sine', 0.2), 100); // E5
    },

    playFail() {
        this.playTone(150, 'sawtooth', 0.3); // Low Buzz
    },

    playGameOver() {
        this.playTone(300, 'triangle', 0.2);
        setTimeout(() => this.playTone(250, 'triangle', 0.2), 200);
        setTimeout(() => this.playTone(200, 'triangle', 0.4), 400);
    }
};