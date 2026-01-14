// js/fretboard/game.js
import { getNoteFromFreq } from '../core/utils.js';
import { SoundManager } from '../core/sound.js'; // 효과음 추가

export class FretboardGame {
    constructor() {
        this.isPlaying = false;
        this.mode = 'free';
        this.score = 0;
        this.target = null;

        // ... (타이머 관련 변수 기존 유지)
        this.startTime = 0;
        this.timeLimit = 0;

        // 정답 판정 (Sustain)
        this.holdingNote = null;
        this.holdFrames = 0;
        this.REQUIRED_HOLD_FRAMES = 10;
        this.VOLUME_THRESHOLD = 0.05;

        // UI 요소
        this.ui = {
            modeSelect: document.getElementById('game-mode-select'),
            playArea: document.getElementById('game-play-area'),
            targetNote: document.getElementById('target-note-display'),
            targetString: document.getElementById('target-string-hint'),
            timerBar: document.getElementById('timer-bar'),
            timerText: document.getElementById('timer-text'),
            score: document.getElementById('score'),
            msg: document.getElementById('feedback-msg'),
            sustainBar: document.getElementById('sustain-bar')
        };

        this.initEventListeners();
    }

    initEventListeners() {
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => this.startGame(card.dataset.mode));
        });
        document.getElementById('btn-stop-game').addEventListener('click', () => this.stopGame());
    }

    // --- 게임 상태 관리 ---
    startGame(mode) {
        this.mode = mode;
        this.score = 0;
        this.isPlaying = true;
        this.ui.score.innerText = 0;

        this.ui.modeSelect.classList.add('hidden');
        this.ui.playArea.classList.remove('hidden');

        // 모드별 설정
        if (mode === 'timeAttack') {
            this.timeLimit = 100 * 1000;
            this.startTime = Date.now();
        } else if (mode === 'infinity') {
            this.timeLimit = 5 * 1000;
        } else {
            this.ui.timerBar.style.width = '100%';
            this.ui.timerText.innerText = '∞';
        }

        this.nextQuestion();
    }

    stopGame() {
        this.isPlaying = false;
        this.ui.playArea.classList.add('hidden');
        this.ui.modeSelect.classList.remove('hidden');
    }

    nextQuestion() {
        if (!this.isPlaying) return;

        // 랜덤 문제
        const questions = [
            { note: 'E', string: 6 }, { note: 'F', string: 6 }, { note: 'G', string: 6 },
            { note: 'A', string: 5 }, { note: 'B', string: 5 }, { note: 'C', string: 5 },
            { note: 'D', string: 4 }, { note: 'E', string: 4 }, { note: 'F', string: 4 },
            { note: 'G', string: 3 }, { note: 'A', string: 3 },
            { note: 'B', string: 2 }, { note: 'C', string: 2 },
            { note: 'E', string: 1 }, { note: 'F', string: 1 }, { note: 'G', string: 1 }
        ];
        this.target = questions[Math.floor(Math.random() * questions.length)];

        this.ui.targetNote.innerText = this.target.note;
        this.ui.targetString.innerText = `${this.target.string}번 줄`;
        this.ui.msg.innerText = "연주하세요 (또는 클릭)";
        this.ui.msg.className = "";

        this.resetHold();

        if (this.mode === 'infinity') this.startTime = Date.now();
    }

    // --- 입력 처리 ---

    // 1. 마이크 입력 (Pitch)
    update(frequency, volume) {
        if (!this.isPlaying) return;
        this.updateTimer();

        if (frequency && volume > this.VOLUME_THRESHOLD) {
            const detected = getNoteFromFreq(frequency);
            const TOLERANCE = 40;

            if (detected.note === this.target.note && Math.abs(detected.cents) < TOLERANCE) {
                // 지속 여부 체크
                if (this.holdingNote === detected.note) {
                    this.holdFrames++;
                } else {
                    this.holdingNote = detected.note;
                    this.holdFrames = 1;
                }

                // 게이지바 업데이트
                const progress = Math.min(100, (this.holdFrames / this.REQUIRED_HOLD_FRAMES) * 100);
                this.ui.sustainBar.style.width = `${progress}%`;
                this.ui.sustainBar.style.backgroundColor = '#3498db';

                if (this.holdFrames >= this.REQUIRED_HOLD_FRAMES) {
                    this.handleSuccess("Mic");
                }
            } else {
                this.resetHold();
            }
        } else {
            this.resetHold();
        }
    }

    // 2. 가상 프렛보드 클릭 입력
    handleVirtualClick(note, stringNum) {
        if (!this.isPlaying) return;

        // 클릭은 Sustain 없이 즉시 판정
        // 줄 번호는 무시하고 음이름만 맞으면 정답 처리 (마이크와 동일 조건)
        if (note === this.target.note) {
            this.handleSuccess("Click");
        } else {
            // 클릭 오답 시 피드백
            this.ui.msg.innerText = "땡!";
            this.ui.msg.className = "fail-anim";
            SoundManager.playFail(); // [효과음]
        }
    }

    // ... (resetHold, updateTimer 등은 기존과 동일) ...
    resetHold() {
        this.holdFrames = 0;
        this.holdingNote = null;
        this.ui.sustainBar.style.width = '0%';
    }

    updateTimer() {
        if (this.mode === 'free') return;
        const now = Date.now();
        let timeLeft = 0, totalTime = 0;

        if (this.mode === 'timeAttack') {
            timeLeft = this.timeLimit - (now - this.startTime);
            totalTime = 100 * 1000;
        } else if (this.mode === 'infinity') {
            timeLeft = this.timeLimit - (now - this.startTime);
            totalTime = 5 * 1000;
        }

        const percent = Math.max(0, (timeLeft / totalTime) * 100);
        this.ui.timerBar.style.width = `${percent}%`;
        this.ui.timerText.innerText = (timeLeft / 1000).toFixed(1);

        if (timeLeft <= 0) this.handleFail();
    }

    // --- 결과 처리 ---
    handleSuccess(source) {
        this.score += 1;
        this.ui.score.innerText = this.score;
        this.ui.msg.innerText = `Nice! (${source})`;
        this.ui.msg.className = "success-anim";
        this.ui.sustainBar.style.backgroundColor = '#2ecc71';

        SoundManager.playSuccess(); // [효과음]

        this.isPlaying = false;
        setTimeout(() => {
            this.isPlaying = true;
            this.nextQuestion();
        }, 500);
    }

    handleFail() {
        if (this.mode === 'infinity' || this.mode === 'timeAttack') {
            this.isPlaying = false;
            this.ui.msg.innerText = "Game Over!";
            this.ui.msg.className = "fail-anim";

            SoundManager.playGameOver(); // [효과음]

            setTimeout(() => {
                alert(`게임 종료! 최종 점수: ${this.score}`);
                this.stopGame();
            }, 1000); // 소리 들을 시간 확보
        }
    }
}