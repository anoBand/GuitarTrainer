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

        // [New] 최고 점수 로드 (LocalStorage 사용)
        // GitHub Pages와 같은 정적 호스팅에서도 브라우저 저장소를 통해 데이터 유지가 가능합니다.
        try {
            this.highScores = JSON.parse(localStorage.getItem('guitar-trainer-highscores')) || {};
        } catch (e) {
            this.highScores = {};
        }

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
            sustainBar: document.getElementById('sustain-bar'),
            // 모달 관련 요소는 createGameOverModal에서 동적으로 추가됩니다.
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

        // [New] 게임 종료 모달 UI 생성 (HTML 의존성 제거를 위해 JS로 생성)
        this.createGameOverModal();

        this.initEventListeners();
    }

    // [New] 모달 UI 동적 생성
    createGameOverModal() {
        // 모달 컨테이너
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

        // 내용 박스
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

        // 제목
        const title = document.createElement('h2');
        title.innerText = 'GAME OVER';
        Object.assign(title.style, {
            marginTop: '0', marginBottom: '1rem',
            color: '#e74c3c', fontSize: '2rem', textTransform: 'uppercase'
        });

        // 메시지 (신기록 등)
        const msg = document.createElement('h3');
        Object.assign(msg.style, {
            color: '#f1c40f', minHeight: '1.5em',
            marginBottom: '1.5rem', fontSize: '1.4rem'
        });

        // 점수 정보
        const scoreInfo = document.createElement('div');
        scoreInfo.style.marginBottom = '2rem';

        // 버튼
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

        // 게임 영역에 모달 추가
        const gameContainer = document.getElementById('fretboard-app') || document.body;
        if (getComputedStyle(gameContainer).position === 'static') {
            gameContainer.style.position = 'relative';
        }
        gameContainer.appendChild(modal);

        // UI 참조 저장
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

    // --- 게임 상태 관리 ---
    startGame(mode) {
        this.mode = mode;
        this.score = 0;
        this.isPlaying = true;
        this.ui.score.innerText = 0;

        // 게임 시작 시 모달 확실히 닫기
        if (this.ui.gameOverModal) this.ui.gameOverModal.style.display = 'none';

        this.ui.modeSelect.classList.add('hidden');
        this.ui.playArea.classList.remove('hidden');

        this.startTime = Date.now();

        // 1. 모드별 시간 및 스타일 설정
        if (mode === 'timeAttack') {
            this.timeLimit = 100 * 1000;
            this.setTimerTextStyle(true);
        } else if (mode === 'infinity') {
            this.timeLimit = 5 * 1000;
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

        // 3. 게임 루프 시작
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
        // 강제 종료 시 모달도 닫음
        if (this.ui.gameOverModal) this.ui.gameOverModal.style.display = 'none';

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

    handleVirtualClick = (note, stringNum) => {
        if (!this.isPlaying) return;

        // 클릭은 즉시 판정
        if (note === this.target.note && Number(stringNum) === this.target.string) {
            this.handleSuccess("Click");
        } else {
            // [수정] 애니메이션 리셋 로직 추가
            // 연속으로 틀렸을 때도 애니메이션이 다시 재생되도록 함
            const msgEl = this.ui.msg;
            msgEl.innerText = "땡!";

            // 1. 기존 클래스 제거
            msgEl.classList.remove('fail-anim');

            // 2. 강제 Reflow (브라우저가 변경사항을 인지하게 함)
            void msgEl.offsetWidth;

            // 3. 클래스 다시 추가
            msgEl.classList.add('fail-anim');

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

    // [수정] 게임 종료 처리: Alert 대신 모달 호출 및 점수 저장
    handleFail() {
        if (this.mode === 'infinity' || this.mode === 'timeAttack') {
            this.isPlaying = false;

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            this.ui.msg.innerText = "시간 종료!";
            this.ui.msg.className = "fail-anim";

            SoundManager.playGameOver();

            // 점수 계산 및 저장 (LocalStorage)
            const currentScore = this.score;
            // 저장된 점수가 없으면 0으로 초기화
            const previousBest = this.highScores[this.mode] || 0;
            let isNewRecord = false;

            if (currentScore > previousBest) {
                this.highScores[this.mode] = currentScore;
                localStorage.setItem('guitar-trainer-highscores', JSON.stringify(this.highScores));
                isNewRecord = true;
            }

            // 잠시 후 모달 표시
            setTimeout(() => {
                this.showGameOverModal(currentScore, isNewRecord ? currentScore : previousBest, isNewRecord);
            }, 500);
        }
    }

    // [New] 모달 표시 메서드
    showGameOverModal(score, bestScore, isNewRecord) {
        if (!this.ui.gameOverModal) return;

        // 메시지 설정
        this.ui.modalMsg.innerText = isNewRecord ? "🎉 New Record! 🎉" : "수고하셨습니다!";

        // 점수 HTML 설정
        this.ui.modalScoreInfo.innerHTML = `
            <div style="margin: 10px 0;">최종 점수: <strong style="color:#fff; font-size:1.6rem;">${score}</strong></div>
            <div style="color:#bdc3c7; font-size:1rem; margin-top: 5px;">최고 기록: ${bestScore}</div>
        `;

        this.ui.gameOverModal.style.display = 'flex';
    }
}