// js/main.js
import { startAudio, getPitch } from './core/pitch.js';
import { TunerApp } from './tuner/tunerApp.js';
import { FretboardGame } from './fretboard/game.js';

// 앱 인스턴스 생성
const tuner = new TunerApp();
const game = new FretboardGame();

let currentMode = 'tuner'; // 초기 모드

// 1. 초기화 버튼 (User Interaction 필수)
const btnInit = document.getElementById('btn-init');
const overlay = document.getElementById('start-overlay');

btnInit.addEventListener('click', async () => {
    btnInit.innerText = "로딩 중...";
    await startAudio(); // 오디오 시작

    overlay.style.display = 'none'; // 오버레이 숨김
    startLoop(); // 루프 시작
});

// 2. 탭 전환 처리
const navTuner = document.getElementById('nav-tuner');
const navGame = document.getElementById('nav-fretboard');
const secTuner = document.getElementById('tuner-app');
const secGame = document.getElementById('fretboard-app');

navTuner.addEventListener('click', () => switchTab('tuner'));
navGame.addEventListener('click', () => switchTab('game'));

function switchTab(mode) {
    currentMode = mode;

    if (mode === 'tuner') {
        // 튜너 활성화
        navTuner.classList.add('active');
        navGame.classList.remove('active');
        secTuner.classList.remove('hidden');
        secGame.classList.add('hidden');

        game.stop(); // 게임 일시정지
    } else {
        // 게임 활성화
        navGame.classList.add('active');
        navTuner.classList.remove('active');
        secGame.classList.remove('hidden');
        secTuner.classList.add('hidden');

        game.start(); // 게임 시작
    }
}

// 3. 메인 루프 (60fps)
function startLoop() {
    function loop() {
        // 피치 감지 (콜백 방식)
        getPitch((frequency) => {
            if (currentMode === 'tuner') {
                tuner.update(frequency);
            } else {
                game.update(frequency);
            }
        });

        requestAnimationFrame(loop);
    }
    loop();
}