// js/fretboard/game.js
import { getNoteFromFreq } from '../core/utils.js';
import { SoundManager } from '../core/sound.js';

export class FretboardGame {
    constructor() {
        this.isPlaying = false;
        this.mode = 'free';
        this.score = 0;
        this.target = null;

        // ... (타이머 관련 변수 기존 유지)
        this.startTime = 0;
        this.timeLimit = 0;

        // [New] 게임 내부 루프 관리를 위한 ID
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

        // [UI 초기화] 타이머 텍스트 위치 조정 (JS로 강제 설정)
        // 시간 바(timerBar)의 위쪽(y축)에 위치하도록 설정
        if (this.ui.timerText) {
            this.ui.timerText.style.position = 'absolute';
            this.ui.timerText.style.left = '0';
            this.ui.timerText.style.top = '-28px'; // 바 위쪽으로 이동 (잘리지 않게 넉넉히)
            this.ui.timerText.style.width = '100%';
            this.ui.timerText.style.transform = 'none';
            this.ui.timerText.style.textAlign = 'center';
            this.ui.timerText.style.pointerEvents = 'none';
            this.ui.timerText.style.textShadow = '';
            this.ui.timerText.style.zIndex = '20'; // 다른 요소보다 위에 표시
        }

        // [핵심 수정] 타이머 바 부모 요소의 overflow 해제
        // CSS에서 overflow: hidden이 걸려있으면 텍스트가 위로 나갈 때 잘려버림.
        // 이를 방지하기 위해 강제로 visible로 변경합니다.
        if (this.ui.timerBar && this.ui.timerBar.parentElement) {
            this.ui.timerBar.parentElement.style.position = 'relative';
            this.ui.timerBar.parentElement.style.overflow = 'visible';
        }

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

        // [버그 수정] 게임 시작 시 startTime을 반드시 초기화
        // 초기화되지 않으면 updateTimer가 실행될 때 남은 시간이 음수가 되어 즉시 게임 오버될 수 있음
        this.startTime = Date.now();

        // [수정] 게임 루프 가동
        // 기존 루프가 있다면 제거 후 새로 시작
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.gameLoop();

        // 모드별 설정
        if (mode === 'timeAttack') {
            this.timeLimit = 100 * 1000;
            // this.startTime = Date.now(); // 위에서 통합 초기화함
            this.setTimerTextStyle(true); // [스타일] 작고 연하게
        } else if (mode === 'infinity') {
            this.timeLimit = 5 * 1000;
            this.setTimerTextStyle(true); // [스타일] 작고 연하게 (실전 모드와 동일)
        } else {
            // Free 모드
            this.ui.timerBar.style.width = '100%';
            this.ui.timerText.innerText = '∞';
            this.setTimerTextStyle(false); // [스타일] 원래대로
        }

        this.target = null;
        this.nextQuestion();
    }

    setTimerTextStyle(isSmallMode) {
        if (isSmallMode) {
            this.ui.timerText.style.fontSize = '0.9rem';
            this.ui.timerText.style.color = '#ccc'; // [수정] 바깥 배경이므로 약간 밝은 회색
            this.ui.timerText.style.fontWeight = '400';
            this.ui.timerText.style.opacity = '1';
        } else {
            // Free 모드 등 (기본값 복구)
            this.ui.timerText.style.fontSize = '';
            this.ui.timerText.style.color = '';
            this.ui.timerText.style.fontWeight = '';
            this.ui.timerText.style.opacity = '';
        }
    }

    stopGame() {
        this.isPlaying = false;

        // [수정] 루프 정리 (메모리 누수 및 좀비 루프 방지)
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.ui.playArea.classList.add('hidden');
        this.ui.modeSelect.classList.remove('hidden');
    }

    // [신규] 게임 내부 루프 (타이머 및 UI 갱신 담당)
    gameLoop() {
        // [중요] 게임 화면이 숨겨져 있다면 루프 중단 (stopGame 호출된 상태)
        if (this.ui.playArea.classList.contains('hidden')) return;

        // isPlaying 플래그와 상관없이 루프는 계속 돕니다.
        // (정답 맞추고 0.5초 대기 시간 등 isPlaying이 false일 때도 루프는 살아있어야 다음 문제로 넘어감)
        if (this.isPlaying) {
            this.updateTimer();
        }

        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    }

    nextQuestion() {
        // nextQuestion은 isPlaying이 true일 때만 실행됨 (handleSuccess의 타임아웃 콜백 등에서)
        if (!this.isPlaying) return;

        let newTarget;
        let retryCount = 0;

        // 1. 중복 방지 (이전 문제와 동일하면 다시 생성)
        do {
            newTarget = this.generateRandomQuestion();
            retryCount++;
        } while (
            this.target &&
            newTarget.note === this.target.note &&
            retryCount < 10 // 무한 루프 방지 안전장치
        );

        this.target = newTarget;

        // 2. UI 업데이트
        this.ui.targetNote.innerText = this.target.displayNote;
        this.ui.targetString.innerText = `${this.target.string}번 줄`;
        this.ui.msg.innerText = "연주하세요 (또는 클릭)";
        this.ui.msg.className = "";

        this.resetHold();

        // 무한 모드는 문제마다 시간 리셋
        if (this.mode === 'infinity') this.startTime = Date.now();
    }

    // [신규] 랜덤 문제 생성 메서드
    generateRandomQuestion() {
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const openStringNotes = ['E', 'B', 'G', 'D', 'A', 'E'];

        // 1. 랜덤 줄 (1~6번)
        const stringNum = Math.floor(Math.random() * 6) + 1;

        // 2. 랜덤 프렛 (0~12프렛: 초보자~중급자 범위)
        const fret = Math.floor(Math.random() * 13);

        // 3. 노트 계산
        const openNote = openStringNotes[stringNum - 1];
        const startIndex = notes.indexOf(openNote);
        const noteIndex = (startIndex + fret) % 12;
        const note = notes[noteIndex]; // 표준 Sharp 표기 (C# 등)

        const isNatural = !note.includes('#');

        // [Free 모드] 난이도 조절: 내추럴 노트(도레미...)만 출제
        if (this.mode === 'free' && !isNatural) {
            return this.generateRandomQuestion(); // 재귀 호출로 다시 뽑기
        }

        // [실전/무한 모드] 표기 확장: # 또는 b 랜덤 표시
        let displayNote = note;
        if ((this.mode === 'timeAttack' || this.mode === 'infinity') && !isNatural) {
            // 50% 확률로 Flat(b) 표기로 변환하여 보여줌
            if (Math.random() > 0.5) {
                const flatMap = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
                if (flatMap[note]) displayNote = flatMap[note];
            }
        }

        return {
            note: note,              // 로직용 (C# 고정)
            displayNote: displayNote,// 화면 표시용 (Db 등 가능)
            string: stringNum
        };
    }

    // --- 입력 처리 ---

    // 1. 마이크 입력 (Pitch)
    update(frequency, volume) {
        if (!this.isPlaying) return;

        // [수정] updateTimer() 호출 제거
        // 타이머는 이제 gameLoop()에서 독립적으로 돌아갑니다.
        // this.updateTimer();

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
        // [수정] 줄 번호(String)와 노트(Note)가 모두 일치해야 정답 처리
        if (note === this.target.note && Number(stringNum) === this.target.string) {
            this.handleSuccess("Click");
        } else {
            this.ui.msg.innerText = "땡!";
            this.ui.msg.className = "fail-anim";
            SoundManager.playFail(); // [효과음]
        }
    }

    resetHold() {
        this.holdFrames = 0;
        this.holdingNote = null;
        this.ui.sustainBar.style.width = '0%';
    }

    updateTimer() {
        if (this.mode === 'free') return;

        // [안전장치] startTime이 0이면 계산 스킵
        if (!this.startTime) return;

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

        // [수정] 남은 시간 표시 로직
        const seconds = Math.max(0, timeLeft / 1000);
        let timeStr;

        // 5초 미만일 때는 소수점 1자리, 그 외에는 정수(올림)로 표시
        if (seconds < 5) {
            timeStr = seconds.toFixed(1);
        } else {
            timeStr = Math.ceil(seconds);
        }

        this.ui.timerText.innerText = `남은 시간: ${timeStr}s`;

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
        // [주의] 여기서 isPlaying이 false가 되어도 gameLoop는 계속 돕니다.
        setTimeout(() => {
            this.isPlaying = true;
            this.nextQuestion();
        }, 500);
    }

    handleFail() {
        if (this.mode === 'infinity' || this.mode === 'timeAttack') {
            this.isPlaying = false;

            // [수정] 실패 시 루프 정지 (alert 전에 멈추는 것이 안전)
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

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