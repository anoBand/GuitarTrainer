// js/metronome/metronome.js
import { SoundManager } from '../core/sound.js';

export class Metronome {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.bpm = 120;
        this.beatsPerMeasure = 4;
        this.currentBeatInMeasure = 0;

        this.lookahead = 25.0;
        this.scheduleAheadTime = 0.1;
        this.nextNoteTime = 0.0;
        this.timerID = null;
        this.notesInQueue = [];

        this.tapTimes = [];
        this.TAP_TIMEOUT = 2000;

        this.ui = {
            startBtn: document.getElementById('metro-btn-start'),
            bpmDisplay: document.getElementById('metro-bpm-display'),
            bpmSlider: document.getElementById('metro-bpm-slider'),
            minus10: document.getElementById('metro-btn-m10'),
            minus5: document.getElementById('metro-btn-m5'),
            plus5: document.getElementById('metro-btn-p5'),
            plus10: document.getElementById('metro-btn-p10'),
            tapBtn: document.getElementById('metro-btn-tap'),
            visuals: document.querySelectorAll('.metro-beat-indicator'),
            volumeSlider: document.getElementById('metro-volume'),
            soundSelect: document.getElementById('metro-sound-select'),
            // [New] 악센트 체크박스 추가
            accentCheck: document.getElementById('metro-accent-check')
        };

        this.initEventListeners();
        this.updateUI();
    }

    initEventListeners() {
        if (!this.ui.startBtn) return;

        this.ui.startBtn.addEventListener('click', () => {
            if (this.isPlaying) this.stop();
            else this.start();
        });

        this.ui.bpmSlider.addEventListener('input', (e) => {
            this.bpm = Number(e.target.value);
            this.updateUI();
        });

        if (this.ui.bpmDisplay) {
            this.ui.bpmDisplay.addEventListener('change', (e) => this.validateAndSetBpm(e.target.value));
            this.ui.bpmDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.validateAndSetBpm(e.target.value);
                    this.ui.bpmDisplay.blur();
                }
            });
        }

        if (this.ui.minus10) this.ui.minus10.addEventListener('click', () => this.changeBpm(-10));
        if (this.ui.minus5) this.ui.minus5.addEventListener('click', () => this.changeBpm(-5));
        if (this.ui.plus5) this.ui.plus5.addEventListener('click', () => this.changeBpm(5));
        if (this.ui.plus10) this.ui.plus10.addEventListener('click', () => this.changeBpm(10));

        this.ui.tapBtn.addEventListener('click', () => this.handleTap());
    }

    validateAndSetBpm(val) {
        let newBpm = parseInt(val);
        if (isNaN(newBpm)) newBpm = this.bpm;
        newBpm = Math.max(20, Math.min(300, newBpm));
        this.bpm = newBpm;
        this.updateUI();
    }

    changeBpm(delta) {
        this.validateAndSetBpm(this.bpm + delta);
    }

    handleTap() {
        const now = Date.now();
        if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > this.TAP_TIMEOUT) {
            this.tapTimes = [];
        }
        this.tapTimes.push(now);
        if (this.tapTimes.length > 4) this.tapTimes.shift();

        if (this.tapTimes.length > 1) {
            let intervals = [];
            for (let i = 0; i < this.tapTimes.length - 1; i++) {
                intervals.push(this.tapTimes[i+1] - this.tapTimes[i]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const newBpm = Math.round(60000 / avgInterval);
            this.validateAndSetBpm(newBpm);
        }

        this.ui.tapBtn.classList.add('active');
        setTimeout(() => this.ui.tapBtn.classList.remove('active'), 100);
    }

    updateUI() {
        if (this.ui.bpmDisplay) this.ui.bpmDisplay.value = this.bpm;
        if (this.ui.bpmSlider) this.ui.bpmSlider.value = this.bpm;
        if (this.ui.startBtn) this.ui.startBtn.innerText = this.isPlaying ? "STOP" : "START";
    }

    start() {
        if (this.isPlaying) return;

        SoundManager.init();
        this.audioContext = SoundManager.audioContext;

        this.isPlaying = true;
        this.currentBeatInMeasure = 0;
        this.nextNoteTime = this.audioContext.currentTime + 0.1;

        this.timerID = setInterval(() => this.scheduler(), this.lookahead);

        this.drawVisuals();
        this.updateUI();
    }

    stop() {
        this.isPlaying = false;
        clearInterval(this.timerID);
        this.updateUI();
    }

    scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeatInMeasure, this.nextNoteTime);
            this.nextNote();
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeatInMeasure++;
        if (this.currentBeatInMeasure === this.beatsPerMeasure) {
            this.currentBeatInMeasure = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        this.notesInQueue.push({ note: beatNumber, time: time });

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);

        if (SoundManager.masterGain) {
            gain.connect(SoundManager.masterGain);
        } else {
            gain.connect(this.audioContext.destination);
        }

        const style = this.ui.soundSelect ? this.ui.soundSelect.value : 'digital';
        let freqHigh = 1000, freqLow = 800;
        let type = 'sine';

        if (style === 'click') {
            type = 'square';
            freqHigh = 1500;
            freqLow = 1000;
        } else if (style === 'wood') {
            type = 'sine';
            freqHigh = 800;
            freqLow = 600;
        }

        osc.type = type;

        // [Modified] 첫 박자 악센트 처리 (체크박스 확인)
        const isAccentEnabled = this.ui.accentCheck && this.ui.accentCheck.checked;

        if (beatNumber === 0 && isAccentEnabled) {
            osc.frequency.value = freqHigh;
        } else {
            osc.frequency.value = freqLow;
        }

        const volume = this.ui.volumeSlider ? (this.ui.volumeSlider.value / 100) * 0.5 : 0.25;
        gain.gain.value = volume;

        osc.start(time);
        osc.stop(time + 0.05);
    }

    drawVisuals() {
        if (!this.isPlaying) return;

        const draw = () => {
            if (!this.isPlaying) return;

            const currentTime = this.audioContext.currentTime;

            while (this.notesInQueue.length && this.notesInQueue[0].time < currentTime) {
                const currentNote = this.notesInQueue[0];
                this.notesInQueue.splice(0, 1);
                this.triggerBeatVisual(currentNote.note);
            }

            requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
    }

    triggerBeatVisual(beatNumber) {
        if (this.ui.visuals) {
            // [Modified] 악센트 체크 여부 확인
            const isAccentEnabled = this.ui.accentCheck && this.ui.accentCheck.checked;

            this.ui.visuals.forEach((el, index) => {
                if (index === beatNumber) {
                    el.classList.add('active');
                    // 첫 박자이고 악센트가 켜져 있을 때만 'accent' 클래스(빨간색 등) 적용
                    if (beatNumber === 0 && isAccentEnabled) {
                        el.classList.add('accent');
                    }
                } else {
                    el.classList.remove('active', 'accent');
                }
            });

            setTimeout(() => {
                if (this.ui.visuals[beatNumber]) {
                    this.ui.visuals[beatNumber].classList.remove('active', 'accent');
                }
            }, 150);
        }
    }
}