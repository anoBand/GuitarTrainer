// js/fretboard/game.js
import { getNoteFromFreq } from '../core/utils.js';
import { SoundManager } from '../core/sound.js';

export class FretboardGame {
    constructor() {
        this.isPlaying = false;
        this.mode = 'free';
        this.score = 0;
        this.target = null;

        this.startTime = 0;
        this.timeLimit = 0;

        // 게임 내부 루프 ID
        this.animationFrameId = null;

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

        // [UI 초기화] 타이머 텍스트 스타일
        if (this.ui.timerText) {
            this.ui.timerText.style.position = 'absolute';
            this.ui.timerText.style.left = '0';
            this.ui.timerText.style.top = '-28px';
            this.ui.timerText.style.width = '100%';
            this.ui.timerText.style.textAlign = 'center';
            this.ui.timerText.style.pointerEvents = 'none';
            this.ui.timerText.style.zIndex = '20';
        }

        // 타이머 바 부모 요소 overflow 해제
        if (this.ui.timerBar && this.ui.timerBar.parentElement) {
            this.ui.timerBar.parentElement.style.position = 'relative';
            this.ui.timerBar.parentElement.style.overflow = 'visible';
        }

        this.initEventListeners();
    }

    initEventListeners() {
        // [수정] 화살표 함수로 감싸서 this 바인딩 유지
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

        this.startTime = Date.now();

        // [중요 수정] 순서 변경!
        // timeLimit을 먼저 설정한 뒤에 gameLoop를 돌려야 합니다.
        // 그렇지 않으면 timeLimit이 0인 상태로 updateTimer가 실행되어 즉시 게임 오버됩니다.

        // 1. 모드별 시간 및 스타일 설정
        if (mode === 'timeAttack') {
            this.timeLimit = 100 * 1000; // 100초
            this.setTimerTextStyle(true);
        } else if (mode === 'infinity') {
            this.timeLimit = 5 * 1000;   // 5초
            this.setTimerTextStyle(true);
        } else {
            // Free 모드
            this.timeLimit = 0;
            this.ui.timerBar.style.width = '100%';
            this.ui.timerText.innerText = '∞';
            this.setTimerTextStyle(false);
        }

        // 2. 첫 문제 생성
        this.target = null;
        this.nextQuestion();

        // 3. 게임 루프 시작 (설정이 다 끝난 후 실행)
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.gameLoop();
    }

    setTimerTextStyle(isSmallMode) {
        if (!this.ui.timerText) return;

        if (isSmallMode) {
            this.ui.timerText.style.fontSize = '0.9rem';
            this.ui.timerText.style.color = '#ccc';
            this.ui.timerText.style.fontWeight = '400';
        } else {
            this.ui.timerText.style.fontSize = '';
            this.ui.timerText.style.color = '';
            this.ui.timerText.style.fontWeight = '';
        }
    }

    stopGame() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.ui.playArea.classList.add('hidden');
        this.ui.modeSelect.classList.remove('hidden');
    }

    // 게임 내부 루프
    gameLoop() {
        if (this.ui.playArea.classList.contains('hidden')) return;

        if (this.isPlaying) {
            this.updateTimer();
        }

        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    }

    nextQuestion() {
        if (!this.isPlaying) return;

        let newTarget;
        let retryCount = 0;

        do {
            newTarget = this.generateRandomQuestion();
            retryCount++;
        } while (
            this.target &&
            newTarget.note === this.target.note &&
            retryCount < 10
        );

        this.target = newTarget;

        this.ui.targetNote.innerText = this.target.displayNote;
        this.ui.targetString.innerText = `${this.target.string}번 줄`;
        this.ui.msg.innerText = "연주하세요 (또는 클릭)";
        this.ui.msg.className = "";

        this.resetHold();

        // 무한 모드는 문제마다 시간 리셋
        if (this.mode === 'infinity') this.startTime = Date.now();
    }

    generateRandomQuestion() {
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const openStringNotes = ['E', 'B', 'G', 'D', 'A', 'E'];

        const stringNum = Math.floor(Math.random() * 6) + 1;
        const fret = Math.floor(Math.random() * 13);

        const openNote = openStringNotes[stringNum - 1];
        const startIndex = notes.indexOf(openNote);
        const noteIndex = (startIndex + fret) % 12;
        const note = notes[noteIndex];

        const isNatural = !note.includes('#');

        if (this.mode === 'free' && !isNatural) {
            return this.generateRandomQuestion();
        }

        let displayNote = note;
        if ((this.mode === 'timeAttack' || this.mode === 'infinity') && !isNatural) {
            if (Math.random() > 0.5) {
                const flatMap = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
                if (flatMap[note]) displayNote = flatMap[note];
            }
        }

        return {
            note: note,
            displayNote: displayNote,
            string: stringNum
        };
    }

    // --- 입력 처리 ---

    // 1. 마이크 입력 (Pitch)
    update(frequency, volume) {
        if (!this.isPlaying) return;

        if (frequency && volume > this.VOLUME_THRESHOLD) {
            const detected = getNoteFromFreq(frequency);
            const TOLERANCE = 40; // cents 허용 오차

            // [개선] 엄격한 리셋 완화 (노이즈로 인한 끊김 방지)
            if (detected.note === this.target.note && Math.abs(detected.cents) < TOLERANCE) {
                if (this.holdingNote === detected.note) {
                    this.holdFrames++;
                } else {
                    this.holdingNote = detected.note;
                    this.holdFrames = 1;
                }

                const progress = Math.min(100, (this.holdFrames / this.REQUIRED_HOLD_FRAMES) * 100);
                this.ui.sustainBar.style.width = `${progress}%`;
                this.ui.sustainBar.style.backgroundColor = '#3498db';

                if (this.holdFrames >= this.REQUIRED_HOLD_FRAMES) {
                    this.handleSuccess("Mic");
                }
            } else {
                // [개선] 틀린 음이 들어왔을 때 즉시 0으로 만들지 않고 천천히 감소 (Decay)
                // 실수로 살짝 튀는 음에 대한 관대함 부여
                if (this.holdFrames > 0) {
                    this.holdFrames -= 2; // 조금 빠르게 감소
                    if (this.holdFrames < 0) this.holdFrames = 0;

                    // 감소 중 시각적 피드백
                    const progress = (this.holdFrames / this.REQUIRED_HOLD_FRAMES) * 100;
                    this.ui.sustainBar.style.width = `${progress}%`;
                } else {
                    this.resetHold();
                }
            }
        } else {
            // 소리가 안 날 때도 즉시 0보다는 천천히 감소 (Sustain 효과)
            if (this.holdFrames > 0) {
                this.holdFrames -= 1; // 천천히 감소
                const progress = (this.holdFrames / this.REQUIRED_HOLD_FRAMES) * 100;
                this.ui.sustainBar.style.width = `${progress}%`;
            } else {
                this.resetHold();
            }
        }
    }

    // 2. 가상 프렛보드 클릭 입력
    // [중요] this 바인딩 문제를 방지하기 위해 화살표 함수로 선언 권장
    handleVirtualClick = (note, stringNum) => {
        if (!this.isPlaying) return;

        // 클릭은 즉시 판정
        if (note === this.target.note && Number(stringNum) === this.target.string) {
            this.handleSuccess("Click");
        } else {
            this.ui.msg.innerText = "땡!";
            this.ui.msg.className = "fail-anim";
            SoundManager.playFail();
        }
    }

    resetHold() {
        this.holdFrames = 0;
        this.holdingNote = null;
        if (this.ui.sustainBar) this.ui.sustainBar.style.width = '0%';
    }

    updateTimer() {
        if (this.mode === 'free') return;
        if (!this.startTime) return;

        const now = Date.now();
        let timeLeft = 0;
        let totalTime = 1;

        if (this.mode === 'timeAttack') {
            timeLeft = this.timeLimit - (now - this.startTime);
            totalTime = 100 * 1000;
        } else if (this.mode === 'infinity') {
            timeLeft = this.timeLimit - (now - this.startTime);
            totalTime = 5 * 1000;
        }

        // 시간 계산이 음수가 되는 것을 방지 (화면 표시용)
        const displayTime = Math.max(0, timeLeft);

        const percent = Math.max(0, (displayTime / totalTime) * 100);
        if (this.ui.timerBar) this.ui.timerBar.style.width = `${percent}%`;

        const seconds = displayTime / 1000;
        let timeStr;

        if (seconds < 5) {
            timeStr = seconds.toFixed(1);
        } else {
            timeStr = Math.ceil(seconds);
        }

        if (this.ui.timerText) this.ui.timerText.innerText = `남은 시간: ${timeStr}s`;

        // [게임 오버 판정] 실제 시간이 0 이하여야 함
        if (timeLeft <= 0) {
            this.handleFail();
        }
    }

    handleSuccess(source) {
        this.score += 1;
        this.ui.score.innerText = this.score;
        this.ui.msg.innerText = `Nice! (${source})`;
        this.ui.msg.className = "success-anim";
        if (this.ui.sustainBar) this.ui.sustainBar.style.backgroundColor = '#2ecc71';

        SoundManager.playSuccess();

        this.isPlaying = false;

        // 정답 맞춘 후 잠시 대기
        setTimeout(() => {
            this.isPlaying = true;
            this.nextQuestion();
        }, 500);
    }

    handleFail() {
        if (this.mode === 'infinity' || this.mode === 'timeAttack') {
            this.isPlaying = false;

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            this.ui.msg.innerText = "Time Over!";
            this.ui.msg.className = "fail-anim";

            SoundManager.playGameOver();

            setTimeout(() => {
                alert(`게임 종료! 최종 점수: ${this.score}`);
                this.stopGame();
            }, 500);
        }
    }
}