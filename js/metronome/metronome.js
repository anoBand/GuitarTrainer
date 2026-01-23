// js/metronome/metronome.js
import { SoundManager } from '../core/sound.js';

export class Metronome {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.bpm = 120;
        this.beatsPerMeasure = 4; // 4/4박자 기준
        this.currentBeatInMeasure = 0;

        // 스케줄링 변수
        this.lookahead = 25.0; // 25ms마다 스케줄링 함수 실행
        this.scheduleAheadTime = 0.1; // 0.1초 앞서서 오디오 예약
        this.nextNoteTime = 0.0; // 다음 음이 울려야 할 시간
        this.timerID = null;
        this.notesInQueue = []; // 시각화 동기화를 위한 큐

        // Tap Tempo 변수
        this.tapTimes = [];
        this.TAP_TIMEOUT = 2000; // 2초 이상 입력 없으면 탭 리셋

        // UI 요소 캐싱
        this.ui = {
            startBtn: document.getElementById('metro-btn-start'),
            // [수정] Display 자체가 Input 역할을 하므로 동일 요소 매핑
            bpmDisplay: document.getElementById('metro-bpm-display'),
            bpmSlider: document.getElementById('metro-bpm-slider'),
            // [수정] 버튼 ID 변경 (10단위, 5단위)
            minus10: document.getElementById('metro-btn-m10'),
            minus5: document.getElementById('metro-btn-m5'),
            plus5: document.getElementById('metro-btn-p5'),
            plus10: document.getElementById('metro-btn-p10'),
            tapBtn: document.getElementById('metro-btn-tap'),
            visuals: document.querySelectorAll('.metro-beat-indicator'),
            volumeSlider: document.getElementById('metro-volume')
        };

        this.initEventListeners();
        this.updateUI();
    }

    initEventListeners() {
        if (!this.ui.startBtn) return; // UI가 없으면 중단

        // 1. 시작/정지
        this.ui.startBtn.addEventListener('click', () => {
            if (this.isPlaying) this.stop();
            else this.start();
        });

        // 2. BPM 변경 (슬라이더)
        this.ui.bpmSlider.addEventListener('input', (e) => {
            this.bpm = Number(e.target.value);
            this.updateUI();
        });

        // 3. BPM 변경 (Display Input - 엔터키나 포커스 아웃 시 적용)
        // [수정] Display 요소가 Input이므로 직접 이벤트 연결
        if (this.ui.bpmDisplay) {
            this.ui.bpmDisplay.addEventListener('change', (e) => this.validateAndSetBpm(e.target.value));
            this.ui.bpmDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.validateAndSetBpm(e.target.value);
                    this.ui.bpmDisplay.blur(); // 입력 완료 후 포커스 해제
                }
            });
        }

        // 4. BPM 조절 버튼 (±5, ±10)
        if (this.ui.minus10) this.ui.minus10.addEventListener('click', () => this.changeBpm(-10));
        if (this.ui.minus5) this.ui.minus5.addEventListener('click', () => this.changeBpm(-5));
        if (this.ui.plus5) this.ui.plus5.addEventListener('click', () => this.changeBpm(5));
        if (this.ui.plus10) this.ui.plus10.addEventListener('click', () => this.changeBpm(10));

        // 5. Tap Tempo
        this.ui.tapBtn.addEventListener('click', () => this.handleTap());

        // 6. 볼륨 조절
        this.ui.volumeSlider.addEventListener('input', (e) => {
            // 볼륨 로직 필요 시 추가
        });
    }

    validateAndSetBpm(val) {
        let newBpm = parseInt(val);
        if (isNaN(newBpm)) newBpm = this.bpm;
        // 범위 제한 (예: 20 ~ 300)
        newBpm = Math.max(20, Math.min(300, newBpm));
        this.bpm = newBpm;
        this.updateUI();
    }

    changeBpm(delta) {
        this.validateAndSetBpm(this.bpm + delta);
    }

    handleTap() {
        const now = Date.now();

        // 마지막 탭과 시간 차이가 너무 크면 리셋
        if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > this.TAP_TIMEOUT) {
            this.tapTimes = [];
        }

        this.tapTimes.push(now);

        // 최근 4개 탭만 유지
        if (this.tapTimes.length > 4) {
            this.tapTimes.shift();
        }

        if (this.tapTimes.length > 1) {
            // 평균 간격 계산
            let intervals = [];
            for (let i = 0; i < this.tapTimes.length - 1; i++) {
                intervals.push(this.tapTimes[i+1] - this.tapTimes[i]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const newBpm = Math.round(60000 / avgInterval);
            this.validateAndSetBpm(newBpm);
        }

        // 탭 버튼 시각적 피드백
        this.ui.tapBtn.classList.add('active');
        setTimeout(() => this.ui.tapBtn.classList.remove('active'), 100);
    }

    updateUI() {
        // BPM 디스플레이 업데이트 (Input 값 변경)
        if (this.ui.bpmDisplay) this.ui.bpmDisplay.value = this.bpm;
        if (this.ui.bpmSlider) this.ui.bpmSlider.value = this.bpm;
        if (this.ui.startBtn) this.ui.startBtn.innerText = this.isPlaying ? "STOP" : "START";
    }

    // --- Audio Scheduling Logic ---

    start() {
        if (this.isPlaying) return;

        if (!SoundManager.audioContext) {
            SoundManager.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        this.audioContext = SoundManager.audioContext;

        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.currentBeatInMeasure = 0;
        this.nextNoteTime = this.audioContext.currentTime + 0.1;

        this.timerID = setInterval(() => this.scheduler(), this.lookahead);

        // 시각화 루프 시작
        this.drawVisuals();
        this.updateUI();
    }

    stop() {
        this.isPlaying = false;
        clearInterval(this.timerID);
        this.updateUI();
    }

    scheduler() {
        // scheduleAheadTime(0.1s) 이내에 재생해야 할 음표들을 미리 예약
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeatInMeasure, this.nextNoteTime);
            this.nextNote();
        }
    }

    nextNote() {
        // 다음 음표 시간 계산: 60 / BPM = 1박자의 초
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat; // 다음 시간 갱신

        this.currentBeatInMeasure++; // 박자 증가
        if (this.currentBeatInMeasure === this.beatsPerMeasure) {
            this.currentBeatInMeasure = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        // 1. 오디오 재생 (Oscillator)
        this.notesInQueue.push({ note: beatNumber, time: time });

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        // 첫 박자(강박)는 높은 음, 나머지는 낮은 음
        if (beatNumber === 0) {
            osc.frequency.value = 1000; // High pitch
        } else {
            osc.frequency.value = 800;  // Low pitch
        }

        // 볼륨 적용
        const volume = this.ui.volumeSlider ? (this.ui.volumeSlider.value / 100) : 0.5;
        gain.gain.value = volume;

        // 짧게 끊어치기
        osc.start(time);
        osc.stop(time + 0.05);
    }

    // --- Visualization Loop ---
    drawVisuals() {
        if (!this.isPlaying) return;

        const draw = () => {
            if (!this.isPlaying) return;

            const currentTime = this.audioContext.currentTime;

            // 큐에 있는 노트 중 현재 시간을 지난 것들을 처리
            while (this.notesInQueue.length && this.notesInQueue[0].time < currentTime) {
                const currentNote = this.notesInQueue[0];
                this.notesInQueue.splice(0, 1); // 제거

                // UI 업데이트 (Beat Indicator)
                this.triggerBeatVisual(currentNote.note);
            }

            requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
    }

    triggerBeatVisual(beatNumber) {
        // 모든 표시등 끄기
        if (this.ui.visuals) {
            this.ui.visuals.forEach((el, index) => {
                if (index === beatNumber) {
                    el.classList.add('active');
                    // 첫 박자는 다른 색상 (CSS 처리 필요)
                    if (beatNumber === 0) el.classList.add('accent');
                } else {
                    el.classList.remove('active', 'accent');
                }
            });

            // 잠시 후 끄기 (깜빡임 효과)
            setTimeout(() => {
                if (this.ui.visuals[beatNumber]) {
                    this.ui.visuals[beatNumber].classList.remove('active', 'accent');
                }
            }, 150); // 150ms 동안 점등
        }
    }
}