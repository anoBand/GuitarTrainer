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

        // 게임 시작 시 이전 타겟 초기화 (중복 방지 로직이 첫 문제에서 꼬이지 않게)
        this.target = null;
        this.nextQuestion();
    }

    stopGame() {
        this.isPlaying = false;
        this.ui.playArea.classList.add('hidden');
        this.ui.modeSelect.classList.remove('hidden');
    }

    nextQuestion() {
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

        // 2. UI 업데이트 (displayNote 사용)
        this.ui.targetNote.innerText = this.target.displayNote;
        this.ui.targetString.innerText = `${this.target.string}번 줄`;
        this.ui.msg.innerText = "연주하세요 (또는 클릭)";
        this.ui.msg.className = "";

        this.resetHold();

        if (this.mode === 'infinity') this.startTime = Date.now();
    }

    // [신규] 랜덤 문제 생성 메서드
    generateRandomQuestion() {
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        // 1번 줄(E) 부터 6번 줄(E) 까지의 개방현 노트
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
        this.updateTimer();

        if (frequency && volume > this.VOLUME_THRESHOLD) {
            const detected = getNoteFromFreq(frequency);
            const TOLERANCE = 40;

            // 정답 비교는 표준 note(C#)로 수행하여, 화면이 Db여도 C# 소리를 인식함
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