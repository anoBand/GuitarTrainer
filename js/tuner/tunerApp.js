// js/tuner/tunerApp.js
import { getNoteFromFreq } from '../core/utils.js';

export class TunerApp {
    constructor() {
        this.elNote = document.getElementById('tuner-note');
        this.elFreq = document.getElementById('tuner-freq');
        this.elNeedle = document.getElementById('tuner-needle');
        // this.elStatus = document.getElementById('tuner-status');
    }

    update(frequency) {
        if (!frequency) {
            // 소리가 끊기면 잠시 대기 상태로
            // this.elStatus.innerText = "대기 중...";
            return;
        }

        const data = getNoteFromFreq(frequency);

        // 1. 텍스트 업데이트
        this.elNote.innerText = data.note;
        this.elFreq.innerText = `${data.frequency.toFixed(1)} Hz`;
        // this.elStatus.innerText = "";

        // 2. 바늘 위치 계산
        // -50 cents = 0%, 0 cents = 50%, +50 cents = 100%
        let position = 50 + data.cents;

        // 범위 제한 (화면 밖으로 나가지 않게)
        position = Math.max(5, Math.min(95, position));

        this.elNeedle.style.left = `${position}%`;

        // 3. 정확도에 따른 색상 변경 (±5 cents 이내)
        if (Math.abs(data.cents) < 5) {
            this.elNeedle.classList.add('match');
            this.elNote.style.color = '#2ecc71'; // Green
        } else {
            this.elNeedle.classList.remove('match');
            this.elNote.style.color = '#3498db'; // Default Blue
        }
    }
}