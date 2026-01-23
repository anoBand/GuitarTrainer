// js/fretboard/virtualFretboard.js
import { NOTES } from '../core/utils.js';

export class VirtualFretboard {
    constructor(containerId, onNoteClick) {
        this.container = document.getElementById(containerId);
        this.onNoteClick = onNoteClick;
        this.openStrings = ['E', 'B', 'G', 'D', 'A', 'E']; // 1번줄 ~ 6번줄
        this.fretCount = 22;

        if (!this.container) {
            console.error(`VirtualFretboard container (#${containerId}) not found!`);
            return;
        }

        // [안전장치] NOTES가 로드되지 않았을 경우 대비
        if (!NOTES || NOTES.length === 0) {
            console.error("NOTES data is missing from utils.js");
        }

        this.render();
    }

    getFretWidth(fret) {
        if (fret === 0) return 30;
        const baseWidth = 90;
        const decayFactor = 0.94;
        return Math.max(25, baseWidth * Math.pow(decayFactor, fret));
    }

    render() {
        this.container.innerHTML = '';

        this.openStrings.forEach((openNote, stringIdx) => {
            const row = document.createElement('div');
            row.className = 'string-row';
            const stringNum = stringIdx + 1;

            // 0프렛
            row.appendChild(this.createFretCell(openNote, 0, stringNum, true));

            // 1~22프렛
            let currentNoteIndex = NOTES.indexOf(openNote);
            for (let f = 1; f <= this.fretCount; f++) {
                currentNoteIndex = (currentNoteIndex + 1) % 12;
                const noteName = NOTES[currentNoteIndex];
                row.appendChild(this.createFretCell(noteName, f, stringNum, false));
            }
            this.container.appendChild(row);
        });

        this.renderNumberRow();
    }

    createFretCell(note, fret, stringNum, isOpen) {
        const cell = document.createElement('div');
        cell.className = `fret-cell ${isOpen ? 'open' : ''}`;

        // 데이터셋 설정 (CSS 디버깅 등 활용 가능)
        cell.dataset.note = note;
        cell.dataset.string = stringNum;

        const width = this.getFretWidth(fret);
        cell.style.flex = `0 0 ${width}px`;
        cell.style.width = `${width}px`;
        cell.style.position = 'relative';

        const stringLine = document.createElement('div');
        stringLine.className = 'string-line';
        stringLine.style.height = `${stringNum}px`;
        cell.appendChild(stringLine);

        if (stringNum === 4 && !isOpen) {
            this.addInlayMarker(cell, fret);
        }

        // [클릭 이벤트 처리]
        cell.addEventListener('click', (e) => {
            // 1. 시각적 피드백 (눌리는 효과)
            cell.classList.add('clicked');
            setTimeout(() => cell.classList.remove('clicked'), 150);

            // 2. 디버깅 로그 (화면에서 클릭이 먹히는지 확인)
            console.log(`[VF] Cell clicked: ${note} (String: ${stringNum})`);

            // 3. 콜백 호출
            if (this.onNoteClick) {
                this.onNoteClick(note, stringNum);
            }
        });

        return cell;
    }

    addInlayMarker(cell, fret) {
        const inlays = [3, 5, 7, 9, 12, 15, 17, 19, 21];
        if (!inlays.includes(fret)) return;

        const markerContainer = document.createElement('div');
        Object.assign(markerContainer.style, {
            position: 'absolute', top: '0', left: '50%',
            transform: 'translate(-50%, -50%)', zIndex: '5',
            pointerEvents: 'none', display: 'flex',
            flexDirection: 'column', gap: '15px'
        });

        const dotCount = (fret === 12) ? 2 : 1;
        for (let i = 0; i < dotCount; i++) {
            const dot = document.createElement('div');
            Object.assign(dot.style, {
                width: '12px', height: '12px', borderRadius: '50%',
                backgroundColor: 'rgba(200, 200, 200, 0.6)',
                boxShadow: '0 0 2px rgba(0,0,0,0.3)'
            });
            markerContainer.appendChild(dot);
        }
        cell.appendChild(markerContainer);
    }

    renderNumberRow() {
        const numberRow = document.createElement('div');
        numberRow.className = 'string-row numbers';

        const dummyNut = document.createElement('div');
        dummyNut.className = 'fret-cell open number-bg';
        dummyNut.style.width = `${this.getFretWidth(0)}px`;
        dummyNut.style.flex = `0 0 ${this.getFretWidth(0)}px`;
        numberRow.appendChild(dummyNut);

        for (let f = 1; f <= this.fretCount; f++) {
            const cell = document.createElement('div');
            cell.className = 'fret-cell number';
            cell.innerText = f;
            const width = this.getFretWidth(f);
            cell.style.width = `${width}px`;
            cell.style.flex = `0 0 ${width}px`;
            numberRow.appendChild(cell);
        }
        this.container.appendChild(numberRow);
    }
}