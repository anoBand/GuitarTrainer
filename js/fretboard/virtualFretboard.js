// js/fretboard/virtualFretboard.js
import { NOTES } from '../core/utils.js';

export class VirtualFretboard {
    constructor(containerId, onNoteClick) {
        this.container = document.getElementById(containerId);
        this.onNoteClick = onNoteClick;
        this.openStrings = ['E', 'B', 'G', 'D', 'A', 'E']; // 1번줄 ~ 6번줄
        this.fretCount = 22; // [수정] 22프렛까지 확장
        this.render();
    }

    /**
     * 프렛 번호에 따른 너비 계산 (하이프렛으로 갈수록 좁아짐)
     * @param {number} fret 프렛 번호
     * @returns {number} 픽셀 단위 너비
     */
    getFretWidth(fret) {
        // 0프렛(너트)은 고정 너비
        if (fret === 0) return 30;

        // [수정] 1프렛 기준 약 90px에서 시작 (기존 75px 대비 20% 확대)
        const baseWidth = 90;
        const decayFactor = 0.94;
        // 최소 너비도 25 -> 28 정도로 약간 조정 가능하나 유지
        return Math.max(25, baseWidth * Math.pow(decayFactor, fret));
    }

    render() {
        this.container.innerHTML = '';

        // 1. 1번줄(E)부터 6번줄(E)까지 렌더링
        this.openStrings.forEach((openNote, stringIdx) => {
            const row = document.createElement('div');
            row.className = 'string-row';

            const stringNum = stringIdx + 1;

            // 0프렛 (개방현)
            const openCell = this.createFretCell(openNote, 0, stringNum, true);
            row.appendChild(openCell);

            // 1~22프렛
            let currentNoteIndex = NOTES.indexOf(openNote);
            for (let f = 1; f <= this.fretCount; f++) {
                currentNoteIndex = (currentNoteIndex + 1) % 12;
                const noteName = NOTES[currentNoteIndex];
                row.appendChild(this.createFretCell(noteName, f, stringNum, false));
            }
            this.container.appendChild(row);
        });

        // 2. 프렛 번호 표시 행 (맨 아래)
        this.renderNumberRow();
    }

    createFretCell(note, fret, stringNum, isOpen) {
        const cell = document.createElement('div');
        cell.className = `fret-cell ${isOpen ? 'open' : ''}`;
        cell.dataset.note = note;
        cell.dataset.string = stringNum;

        // [디테일] 계산된 너비 적용
        const width = this.getFretWidth(fret);
        cell.style.flex = `0 0 ${width}px`;
        cell.style.width = `${width}px`;
        cell.style.position = 'relative';

        // 시각적 줄 (String Line)
        const stringLine = document.createElement('div');
        stringLine.className = 'string-line';
        stringLine.style.height = `${stringNum}px`; // 저음현일수록 굵게
        cell.appendChild(stringLine);

        // [인레이] 4번줄(D) 기준 배치
        if (stringNum === 4 && !isOpen) {
            this.addInlayMarker(cell, fret);
        }

        // 클릭 이벤트
        cell.addEventListener('click', () => {
            cell.classList.add('clicked');
            setTimeout(() => cell.classList.remove('clicked'), 200);
            if (this.onNoteClick) {
                this.onNoteClick(note, stringNum);
            }
        });

        return cell;
    }

    addInlayMarker(cell, fret) {
        // [수정] 22프렛 확장에 따른 인레이 추가 (17, 19, 21)
        const inlays = [3, 5, 7, 9, 12, 15, 17, 19, 21];
        if (!inlays.includes(fret)) return;

        const markerContainer = document.createElement('div');
        markerContainer.style.position = 'absolute';
        markerContainer.style.top = '0';
        markerContainer.style.left = '50%';
        markerContainer.style.transform = 'translate(-50%, -50%)';
        markerContainer.style.zIndex = '5';
        markerContainer.style.pointerEvents = 'none';
        markerContainer.style.display = 'flex';
        markerContainer.style.flexDirection = 'column';
        markerContainer.style.gap = '15px';

        // 12프렛은 더블 도트, 나머지는 싱글 도트
        const dotCount = (fret === 12) ? 2 : 1;

        for (let i = 0; i < dotCount; i++) {
            const dot = document.createElement('div');
            dot.style.width = '12px';
            dot.style.height = '12px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = 'rgba(200, 200, 200, 0.6)';
            dot.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';
            markerContainer.appendChild(dot);
        }

        cell.appendChild(markerContainer);
    }

    renderNumberRow() {
        const numberRow = document.createElement('div');
        numberRow.className = 'string-row numbers';

        // 0프렛 더미
        const dummyNut = document.createElement('div');
        dummyNut.className = 'fret-cell open number-bg';
        dummyNut.style.flex = `0 0 ${this.getFretWidth(0)}px`;
        dummyNut.style.width = `${this.getFretWidth(0)}px`;
        numberRow.appendChild(dummyNut);

        // 1~22프렛 숫자
        for (let f = 1; f <= this.fretCount; f++) {
            const cell = document.createElement('div');
            cell.className = 'fret-cell number';
            cell.innerText = f;

            const width = this.getFretWidth(f);
            cell.style.flex = `0 0 ${width}px`;
            cell.style.width = `${width}px`;

            numberRow.appendChild(cell);
        }
        this.container.appendChild(numberRow);
    }
}