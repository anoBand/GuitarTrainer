// js/fretboard/game.js
import { getNoteFromFreq } from '../core/utils.js';

export class FretboardGame {
    constructor() {
        this.isPlaying = false;
        this.score = 0;
        this.target = null; // { note: 'A', string: 5 }
        this.timer = null;
        this.startTime = 0;
        this.TIME_LIMIT = 4000; // 문제당 4초

        // DOM 요소
        this.elTargetNote = document.getElementById('target-note-display');
        this.elTargetString = document.getElementById('target-string-hint');
        this.elTimerBar = document.getElementById('timer-bar');
        this.elScore = document.getElementById('score');
        this.elMsg = document.getElementById('feedback-msg');

        // 재시작 버튼 이벤트
        document.getElementById('btn-game-restart').addEventListener('click', () => this.restart());
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.score = 0;
        this.updateScore();
        this.nextQuestion();
    }

    stop() {
        this.isPlaying = false;
        this.elMsg.innerText = "일시정지";
    }

    restart() {
        this.stop();
        this.start();
    }

    nextQuestion() {
        if (!this.isPlaying) return;

        // 1. 랜덤 문제 생성
        // 간단한 오픈 코드 및 5프렛 이내 음들 위주로 구성
        const questions = [
            { note: 'E', string: 6 }, { note: 'F', string: 6 }, { note: 'G', string: 6 },
            { note: 'A', string: 5 }, { note: 'B', string: 5 }, { note: 'C', string: 5 },
            { note: 'D', string: 4 }, { note: 'E', string: 4 }, { note: 'F', string: 4 },
            { note: 'G', string: 3 }, { note: 'A', string: 3 },
            { note: 'B', string: 2 }, { note: 'C', string: 2 }, { note: 'D', string: 2 },
            { note: 'E', string: 1 }, { note: 'F', string: 1 }, { note: 'G', string: 1 }
        ];

        this.target = questions[Math.floor(Math.random() * questions.length)];

        // UI 표시
        this.elTargetNote.innerText = this.target.note;
        this.elTargetString.innerText = `${this.target.string}번 줄`;
        this.elMsg.innerText = "연주하세요!";
        this.elMsg.className = "";

        // 타이머 리셋
        this.startTime = Date.now();
        this.elTimerBar.classList.remove('urgent');
    }

    update(frequency) {
        if (!this.isPlaying) return;

        // 1. 타이머 처리
        const elapsed = Date.now() - this.startTime;
        const timeLeft = this.TIME_LIMIT - elapsed;
        const percent = Math.max(0, (timeLeft / this.TIME_LIMIT) * 100);

        this.elTimerBar.style.width = `${percent}%`;

        // 시간이 얼마 안 남으면 빨간색으로
        if (percent < 20) this.elTimerBar.classList.add('urgent');

        if (timeLeft <= 0) {
            this.handleFail();
            return;
        }

        // 2. 정답 체크 (소리가 감지될 때만)
        if (frequency) {
            const detected = getNoteFromFreq(frequency);

            // 중요: 튜너보다 오차 범위를 넓게 설정 (±40 cents)
            // 게임 흐름이 끊기지 않게 하기 위함
            const TOLERANCE = 40;

            if (detected.note === this.target.note && Math.abs(detected.cents) < TOLERANCE) {
                // 주파수가 맞으면 정답 처리
                // (줄 번호는 오디오로 완벽 구분 불가능하므로, 음이 맞으면 넘어감)
                this.handleSuccess();
            }
        }
    }

    handleSuccess() {
        this.score += 10;
        this.updateScore();

        this.elMsg.innerText = "정답! 🎉";
        this.elMsg.className = "success-anim";

        // 쿨타임 없이 바로 다음 문제 (속도감)
        // 아주 짧은 딜레이만 줌 (사용자가 인지할 수 있게)
        this.isPlaying = false; // 중복 정답 방지
        setTimeout(() => {
            this.isPlaying = true;
            this.nextQuestion();
        }, 300);
    }

    handleFail() {
        this.elMsg.innerText = "시간 초과! 😅";
        this.elMsg.className = "fail-anim";

        this.isPlaying = false; // 일시 정지
        // 1초 뒤 다음 문제
        setTimeout(() => {
            this.isPlaying = true;
            this.nextQuestion();
        }, 1000);
    }

    updateScore() {
        this.elScore.innerText = this.score;
    }
}