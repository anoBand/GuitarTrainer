//main.js
import { startAudio, getPitch, getAudioDevices } from './core/pitch.js';
import { TunerApp } from './tuner/tunerApp.js';
import { FretboardGame } from './fretboard/game.js';
import { VirtualFretboard } from './fretboard/virtualFretboard.js';
import { SoundManager } from './core/sound.js';

const tuner = new TunerApp();
const game = new FretboardGame();

// [수정] 초기 모드 설정을 DOM 상태와 동기화
const secTuner = document.getElementById('tuner-app');
let currentMode = (secTuner && !secTuner.classList.contains('hidden')) ? 'tuner' : 'game';

let animationFrameId = null;
let isLoopRunning = false;

// [수정] 가상 프렛보드 초기화 (디버깅 로그 및 안전장치 추가)
const vFretboard = new VirtualFretboard('virtual-fretboard', (note, string) => {
    console.log(`[Main] Click received: ${note} on String ${string}`); // 클릭 확인용 로그

    // 조건 완화: 현재 모드가 게임이거나, 게임이 실행 중(isPlaying)이라면 입력 허용
    if (currentMode === 'game' || game.isPlaying) {
        // [중요] game 인스턴스가 초기화되었는지 확인
        if (game && typeof game.handleVirtualClick === 'function') {
            game.handleVirtualClick(note, string);
        } else {
            console.error("Game instance or handleVirtualClick is missing!");
        }
    } else {
        console.warn(`Click ignored. CurrentMode: ${currentMode}, GamePlaying: ${game.isPlaying}`);
    }
});

// --- 1. 오디오 초기화 ---
const btnInit = document.getElementById('btn-init');
const overlay = document.getElementById('start-overlay');

if (btnInit) {
    btnInit.addEventListener('click', async () => {
        btnInit.innerText = "연결 중...";
        try {
            await startAudio();
            if (overlay) overlay.style.display = 'none';
            startLoop();
        } catch (err) {
            console.error("Audio init failed:", err);
            btnInit.innerText = "오류 발생 (재시도)";
        }
    });
}

/* =========================================
   테마 변경 로직
   ========================================= */
const btnTheme = document.getElementById('btn-theme');
const savedTheme = localStorage.getItem('theme');

if (savedTheme === 'light') {
    document.documentElement.classList.add('light-mode');
    if (btnTheme) btnTheme.textContent = '☀️';
} else {
    if (btnTheme) btnTheme.textContent = '🌙';
}

if (btnTheme) {
    btnTheme.addEventListener('click', () => {
        const isLight = document.documentElement.classList.toggle('light-mode');
        if (isLight) {
            btnTheme.textContent = '☀️';
            localStorage.setItem('theme', 'light');
        } else {
            btnTheme.textContent = '🌙';
            localStorage.setItem('theme', 'dark');
        }
    });
}

// 볼륨 슬라이더
const volSlider = document.getElementById('volume-slider');
if (volSlider) {
    volSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        SoundManager.setVolume(val);
    });
}

// --- 2. ⚙️ 설정 모달 로직 ---
const btnSettings = document.getElementById('btn-settings');
const modal = document.getElementById('settings-modal');
const modalSelect = document.getElementById('modal-audio-source');
const btnSave = document.getElementById('btn-save-settings');
const btnClose = document.getElementById('btn-close-settings');

if (btnSettings && modal) {
    btnSettings.addEventListener('click', async () => {
        modal.showModal();
        const devices = await getAudioDevices();
        if (modalSelect) {
            modalSelect.innerHTML = '';
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Mic ${modalSelect.length + 1}`;
                modalSelect.add(option);
            });
        }
    });
}

if (btnSave && modal) {
    btnSave.addEventListener('click', async () => {
        const selectedDeviceId = modalSelect.value;
        if (selectedDeviceId) {
            stopLoop();
            await startAudio(selectedDeviceId);
            startLoop();
        }
        modal.close();
    });
}

if (btnClose && modal) btnClose.addEventListener('click', () => modal.close());


// --- 3. 탭 전환 ---
const navTuner = document.getElementById('nav-tuner');
const navGame = document.getElementById('nav-fretboard');
const secGame = document.getElementById('fretboard-app');

if (navTuner && navGame) {
    navTuner.addEventListener('click', () => switchTab('tuner'));
    navGame.addEventListener('click', () => switchTab('game'));
}

function switchTab(mode) {
    currentMode = mode;
    console.log(`Tab switched to: ${mode}`); // 탭 전환 확인 로그

    if (mode === 'tuner') {
        navTuner.classList.add('active');
        navGame.classList.remove('active');
        if (secTuner) secTuner.classList.remove('hidden');
        if (secGame) secGame.classList.add('hidden');
        if (game) game.stopGame();
    } else {
        navGame.classList.add('active');
        navTuner.classList.remove('active');
        if (secGame) secGame.classList.remove('hidden');
        if (secTuner) secTuner.classList.add('hidden');
    }
}

// --- 4. 메인 루프 ---
function loop() {
    if (!isLoopRunning) return;

    getPitch((frequency, volume) => {
        if (currentMode === 'tuner') {
            tuner.update(frequency);
        } else {
            // 게임 모드일 때만 게임 업데이트
            game.update(frequency, volume);
        }
    });

    animationFrameId = requestAnimationFrame(loop);
}

function startLoop() {
    if (isLoopRunning) return;
    isLoopRunning = true;
    loop();
    console.log("Main Loop Started");
}

function stopLoop() {
    isLoopRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    console.log("Main Loop Stopped");
}

// 백그라운드 처리 (visibilitychange)
document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
        stopLoop();
    } else {
        if (SoundManager.audioContext && SoundManager.audioContext.state === 'suspended') {
            await SoundManager.audioContext.resume();
        }
        startLoop();
    }
});