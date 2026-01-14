// js/fretboard/virtualFretboard.js
import { NOTES } from '../core/utils.js';

export class VirtualFretboard {
    constructor(containerId, onNoteClick) {
        this.container = document.getElementById(containerId);
        this.onNoteClick = onNoteClick;
        this.openStrings = ['E', 'B', 'G', 'D', 'A', 'E']; // 1번줄 ~ 6번줄
        this.fretCount = 15; // 15프렛까지 확장
        this.render();
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

            // 1~15프렛
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

        // 시각적 줄 (String Line)
        const stringLine = document.createElement('div');
        stringLine.className = 'string-line';
        stringLine.style.height = `${stringNum}px`; // 저음현일수록 굵게
        cell.appendChild(stringLine);

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

    renderNumberRow() {
        const numberRow = document.createElement('div');
        numberRow.className = 'string-row numbers';

        // [중요] 정렬을 맞추기 위한 0프렛 더미 공간
        // 위쪽 줄들의 'open' 클래스와 동일한 너비/테두리를 가져야 1번 프렛 시작점이 맞음
        const dummyNut = document.createElement('div');
        dummyNut.className = 'fret-cell open number-bg';
        numberRow.appendChild(dummyNut);

        // 1~15프렛 숫자
        for (let f = 1; f <= this.fretCount; f++) {
            const cell = document.createElement('div');
            cell.className = 'fret-cell number';
            cell.innerText = f;

            // 시각적 가이드 (3, 5, 7, 9, 12, 15)
            if ([3, 5, 7, 9, 12, 15].includes(f)) {
                cell.style.color = 'var(--accent-color)';
            }

            numberRow.appendChild(cell);
        }
        this.container.appendChild(numberRow);
    }
}