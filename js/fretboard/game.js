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

        this.animationFrameId = null;
        this.holdingNote = null;
        this.holdFrames = 0;
        this.REQUIRED_HOLD_FRAMES = 10;
        this.VOLUME_THRESHOLD = 0.05;

        try {
            this.highScores = JSON.parse(localStorage.getItem('guitar-trainer-highscores')) || {};
        } catch (e) {
            this.highScores = {};
        }

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

        if (this.ui.timerText) {
            this.ui.timerText.style.position = 'absolute';
            this.ui.timerText.style.left = '0';
            this.ui.timerText.style.top = '-28px';
            this.ui.timerText.style.width = '100%';
            this.ui.timerText.style.textAlign = 'center';
            this.ui.timerText.style.pointerEvents = 'none';
            this.ui.timerText.style.zIndex = '20';
        }

        if (this.ui.timerBar && this.ui.timerBar.parentElement) {
            this.ui.timerBar.parentElement.style.position = 'relative';
            this.ui.timerBar.parentElement.style.overflow = 'visible';
        }

        this.createGameOverModal();
        this.initEventListeners();
    }

    createGameOverModal() {
        const modal = document.createElement('div');
        modal.id = 'custom-game-over-modal';
        Object.assign(modal.style, {
            display: 'none',
            position: 'absolute',
            top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: '1000',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            color: 'white',
            fontFamily: 'sans-serif',
            backdropFilter: 'blur(4px)'
        });

        const content = document.createElement('div');
        Object.assign(content.style, {
            backgroundColor: '#2c3e50',
            padding: '2.5rem',
            borderRadius: '16px',
            textAlign: 'center',
            border: '2px solid #3498db',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            minWidth: '320px',
            maxWidth: '90%'
        });

        const title = document.createElement('h2');
        title.innerText = 'GAME OVER';
        Object.assign(title.style, {
            marginTop: '0', marginBottom: '1rem',
            color: '#e74c3c', fontSize: '2rem', textTransform: 'uppercase'
        });

        const msg = document.createElement('h3');
        Object.assign(msg.style, {
            color: '#f1c40f', minHeight: '1.5em',
            marginBottom: '1.5rem', fontSize: '1.4rem'
        });

        const scoreInfo = document.createElement('div');
        scoreInfo.style.marginBottom = '2rem';

        const btn = document.createElement('button');
        btn.innerText = '확인';
        Object.assign(btn.style, {
            padding: '12px 40px', fontSize: '1.1rem',
            backgroundColor: '#3498db', color: 'white',
            border: 'none', borderRadius: '8px',
            cursor: 'pointer', transition: 'background 0.2s'
        });

        btn.onmouseover = () => btn.style.backgroundColor = '#2980b9';
        btn.onmouseout = () => btn.style.backgroundColor = '#3498db';
        btn.onclick = () => {
            modal.style.display = 'none';
            this.stopGame();
        };

        content.append(title, msg, scoreInfo, btn);
        modal.appendChild(content);

        const gameContainer = document.getElementById('fretboard-app') || document.body;
        if (getComputedStyle(gameContainer).position === 'static') {
            gameContainer.style.position = 'relative';
        }
        gameContainer.appendChild(modal);

        this.ui.gameOverModal = modal;
        this.ui.modalMsg = msg;
        this.ui.modalScoreInfo = scoreInfo;
    }

    initEventListeners() {
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => this.startGame(card.dataset.mode));
        });
        document.getElementById('btn-stop-game').addEventListener('click', () => this.stopGame());
    }

    startGame(mode) {
        this.mode = mode;
        this.score = 0;
        this.isPlaying = true;
        this.ui.score.innerText = 0;

        if (this.ui.gameOverModal) this.ui.gameOverModal.style.display = 'none';

        this.ui.modeSelect.classList.add('hidden');
        this.ui.playArea.classList.remove('hidden');

        this.startTime = Date.now();

        if (mode === 'timeAttack') {
            this.timeLimit = 100 * 1000;
            this.setTimerTextStyle(true);
        } else if (mode === 'infinity') {
            this.timeLimit = 5 * 1000;
            this.setTimerTextStyle(true);
        } else {
            this.timeLimit = 0;
            this.ui.timerBar.style.width = '100%';
            this.ui.timerText.innerText = '∞';
            this.setTimerTextStyle(false);
        }

        this.target = null;
        this.nextQuestion();

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.gameLoop();
    }

    setTimerTextStyle(isSmallMode) {
        if (!this.ui.timerText) return;

        if (isSmallMode) {
            this.ui.timerText.style.fontSize = '0.9rem';
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
        if (this.ui.gameOverModal) this.ui.gameOverModal.style.display = 'none';

        this.ui.playArea.classList.add('hidden');
        this.ui.modeSelect.classList.remove('hidden');
    }

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

    update(frequency, volume) {
        if (!this.isPlaying) return;

        if (frequency && volume > this.VOLUME_THRESHOLD) {
            const detected = getNoteFromFreq(frequency);
            const TOLERANCE = 40;

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
                if (this.holdFrames > 0) {
                    this.holdFrames -= 2;
                    if (this.holdFrames < 0) this.holdFrames = 0;

                    const progress = (this.holdFrames / this.REQUIRED_HOLD_FRAMES) * 100;
                    this.ui.sustainBar.style.width = `${progress}%`;
                } else {
                    this.resetHold();
                }
            }
        } else {
            if (this.holdFrames > 0) {
                this.holdFrames -= 1;
                const progress = (this.holdFrames / this.REQUIRED_HOLD_FRAMES) * 100;
                this.ui.sustainBar.style.width = `${progress}%`;
            } else {
                this.resetHold();
            }
        }
    }

    handleVirtualClick = (note, stringNum, fret) => {
        if (!this.isPlaying) return;

        // 1. 클릭한 노트 소리 재생
        this.playNoteSound(stringNum, fret);

        // 2. 정답 판정
        if (note === this.target.note && Number(stringNum) === this.target.string) {
            this.handleSuccess("Click");
        } else {
            const msgEl = this.ui.msg;
            msgEl.innerText = "땡!";
            msgEl.classList.remove('fail-anim');
            void msgEl.offsetWidth;
            msgEl.classList.add('fail-anim');

            // [수정] 오답 소리 재생 로직 제거됨
        }
    }

    playNoteSound(stringNum, fret) {
        // [Safety] fret이 유효하지 않으면 소리 재생 스킵
        if (typeof fret !== 'number') return;

        const openStringFreqs = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41];

        if (stringNum < 1 || stringNum > 6) return;

        const baseFreq = openStringFreqs[stringNum - 1];

        // [수정] 음정 보정 로직(fret + 1)을 제거하고 정상(fret)으로 복구
        // 기준 파일이 A2(110Hz)이므로 pitch shifting이 정확하게 맞음
        const frequency = baseFreq * Math.pow(2, fret / 12);

        // [수정] 지속 시간 3.0초로 2배 증가
        SoundManager.playGuitarTone(frequency, 3.0);
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

        if (timeLeft <= 0) {
            this.handleFail();
        }
    }

    handleSuccess(source) {
        this.score += 1;
        this.ui.score.innerText = this.score;
        this.ui.msg.innerText = `정답!`;
        this.ui.msg.className = "success-anim";
        if (this.ui.sustainBar) this.ui.sustainBar.style.backgroundColor = '#2ecc71';

        SoundManager.playSuccess();

        this.isPlaying = false;

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

            const currentScore = this.score;
            const previousBest = this.highScores[this.mode] || 0;
            let isNewRecord = false;

            if (currentScore > previousBest) {
                this.highScores[this.mode] = currentScore;
                localStorage.setItem('guitar-trainer-highscores', JSON.stringify(this.highScores));
                isNewRecord = true;
            }

            setTimeout(() => {
                this.showGameOverModal(currentScore, isNewRecord ? currentScore : previousBest, isNewRecord);
            }, 500);
        }
    }

    showGameOverModal(score, bestScore, isNewRecord) {
        if (!this.ui.gameOverModal) return;

        this.ui.modalMsg.innerText = isNewRecord ? "🎉 New Record! 🎉" : "수고하셨습니다!";

        this.ui.modalScoreInfo.innerHTML = `
            <div style="margin: 10px 0;">최종 점수: <strong style="color:#fff; font-size:1.6rem;">${score}</strong></div>
            <div style="color:#bdc3c7; font-size:1rem; margin-top: 5px;">최고 기록: ${bestScore}</div>
        `;

        this.ui.gameOverModal.style.display = 'flex';
    }
}