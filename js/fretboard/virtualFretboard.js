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

    /**
     * 프렛 번호에 따른 너비 계산 (하이프렛으로 갈수록 좁아짐)
     * @param {number} fret 프렛 번호
     * @returns {number} 픽셀 단위 너비
     */
    getFretWidth(fret) {
        // 0프렛(너트)은 고정 너비
        if (fret === 0) return 30;

        // 1프렛 기준 약 75px에서 시작하여 점차 좁아지는 비율 적용 (0.943은 17.817 법칙 근사치)
        const baseWidth = 75;
        const decayFactor = 0.94;
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

        // [디테일] 계산된 너비 적용 (flex-grow 방지를 위해 flex 스타일 강제 지정)
        const width = this.getFretWidth(fret);
        cell.style.flex = `0 0 ${width}px`;
        cell.style.width = `${width}px`;
        cell.style.position = 'relative'; // 인레이 절대 위치를 위해

        // 시각적 줄 (String Line)
        const stringLine = document.createElement('div');
        stringLine.className = 'string-line';
        stringLine.style.height = `${stringNum}px`; // 저음현일수록 굵게
        cell.appendChild(stringLine);

        // [신규] 인레이(Inlay) 마크 추가
        // 4번줄(D)의 3, 5, 7, 9, 12, 15 프렛에 표시
        // 4번줄 셀의 상단(top: 0)에 배치하면 3번줄과 4번줄 사이에 위치하게 됨
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
        const inlays = [3, 5, 7, 9, 12, 15];
        if (!inlays.includes(fret)) return;

        const markerContainer = document.createElement('div');
        // 스타일: 부모(4번줄 셀)의 상단 중앙에 위치 -> 3~4번줄 사이로 보임
        markerContainer.style.position = 'absolute';
        markerContainer.style.top = '0';
        markerContainer.style.left = '50%';
        markerContainer.style.transform = 'translate(-50%, -50%)';
        markerContainer.style.zIndex = '5';
        markerContainer.style.pointerEvents = 'none'; // 클릭 방해 방지
        markerContainer.style.display = 'flex';
        markerContainer.style.flexDirection = 'column';
        markerContainer.style.gap = '15px'; // 더블 도트 간격

        // 12프렛은 더블 도트, 나머지는 싱글 도트
        const dotCount = (fret === 12) ? 2 : 1;

        for (let i = 0; i < dotCount; i++) {
            const dot = document.createElement('div');
            dot.style.width = '12px';
            dot.style.height = '12px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = 'rgba(200, 200, 200, 0.6)'; // 은은한 회색
            dot.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';
            markerContainer.appendChild(dot);
        }

        cell.appendChild(markerContainer);
    }

    renderNumberRow() {
        const numberRow = document.createElement('div');
        numberRow.className = 'string-row numbers';

        // 0프렛 더미 공간
        const dummyNut = document.createElement('div');
        dummyNut.className = 'fret-cell open number-bg';
        dummyNut.style.flex = `0 0 ${this.getFretWidth(0)}px`;
        dummyNut.style.width = `${this.getFretWidth(0)}px`;
        numberRow.appendChild(dummyNut);

        // 1~15프렛 숫자
        for (let f = 1; f <= this.fretCount; f++) {
            const cell = document.createElement('div');
            cell.className = 'fret-cell number';
            cell.innerText = f;

            // [수정] 너비 동기화
            const width = this.getFretWidth(f);
            cell.style.flex = `0 0 ${width}px`;
            cell.style.width = `${width}px`;

            // [수정] 기존 색상 변경 로직 삭제 (인레이로 대체되었으므로)
            // 기본 스타일 유지

            numberRow.appendChild(cell);
        }
        this.container.appendChild(numberRow);
    }
}