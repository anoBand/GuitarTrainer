// js/main.js
import { startAudio, getPitch, getAudioDevices } from './core/pitch.js';
import { TunerApp } from './tuner/tunerApp.js';
import { FretboardGame } from './fretboard/game.js';
import { VirtualFretboard } from './fretboard/virtualFretboard.js';
import { SoundManager } from './core/sound.js';
import { Metronome } from './metronome/metronome.js';

const tuner = new TunerApp();
const game = new FretboardGame();
const metronome = new Metronome();

const secTuner = document.getElementById('tuner-app');
const secGame = document.getElementById('fretboard-app');
const secMetronome = document.getElementById('metronome-app');

// [초기화] 현재 활성화된 탭 감지
let currentMode = 'tuner';
if (secTuner && !secTuner.classList.contains('hidden')) currentMode = 'tuner';
else if (secGame && !secGame.classList.contains('hidden')) currentMode = 'game';
else if (secMetronome && !secMetronome.classList.contains('hidden')) currentMode = 'metronome';

let animationFrameId = null;
let isLoopRunning = false;

// [가상 프렛보드]
// [수정] fret 인자 추가
const vFretboard = new VirtualFretboard('virtual-fretboard', (note, string, fret) => {
    // [최적화] 게임 모드일 때만 클릭 이벤트 전달
    if (currentMode === 'game' || game.isPlaying) {
        if (game && typeof game.handleVirtualClick === 'function') {
            game.handleVirtualClick(note, string, fret);
        }
    }
});

// --- 1. 오디오 초기화 ---
const btnInit = document.getElementById('btn-init');
const overlay = document.getElementById('start-overlay');
const btnNoMic = document.getElementById('btn-no-mic');

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

if (btnNoMic) {
    btnNoMic.addEventListener('click', () => {
        if (overlay) overlay.style.display = 'none';
        console.log("Started without microphone input.");
    });
}

/* =========================================
   테마 및 볼륨 설정
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

const volSlider = document.getElementById('volume-slider');
if (volSlider) {
    volSlider.addEventListener('input', (e) => {
        SoundManager.setVolume(parseFloat(e.target.value));
    });
}

// ... (설정 모달 로직) ...
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
const navMetronome = document.getElementById('nav-metronome');

if (navTuner) navTuner.addEventListener('click', () => switchTab('tuner'));
if (navGame) navGame.addEventListener('click', () => switchTab('game'));
if (navMetronome) navMetronome.addEventListener('click', () => switchTab('metronome'));

function switchTab(mode) {
    if (currentMode === mode) return;

    console.log(`Switching Tab: ${currentMode} -> ${mode}`);

    // 1. [Cleanup] 기존 모드 정리
    if (currentMode === 'game') {
        game.stopGame();
    }
    else if (currentMode === 'metronome') {
        metronome.stop();
    }

    // 2. [UI Reset] 모든 탭 숨기기
    [secTuner, secGame, secMetronome].forEach(el => el && el.classList.add('hidden'));
    [navTuner, navGame, navMetronome].forEach(el => el && el.classList.remove('active'));

    // 3. [Activate] 선택된 모드 활성화
    currentMode = mode;

    switch (mode) {
        case 'tuner':
            if (secTuner) secTuner.classList.remove('hidden');
            if (navTuner) navTuner.classList.add('active');
            break;

        case 'game':
            if (secGame) secGame.classList.remove('hidden');
            if (navGame) navGame.classList.add('active');
            break;

        case 'metronome':
            if (secMetronome) secMetronome.classList.remove('hidden');
            if (navMetronome) navMetronome.classList.add('active');
            break;
    }
}

// --- 4. 메인 루프 ---
function loop() {
    if (!isLoopRunning) return;

    if (currentMode === 'metronome') {
        animationFrameId = requestAnimationFrame(loop);
        return;
    }

    getPitch((frequency, volume) => {
        if (currentMode === 'tuner') {
            tuner.update(frequency);
        } else if (currentMode === 'game') {
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

document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
        stopLoop();
        if (currentMode === 'metronome') metronome.stop();
    } else {
        if (SoundManager.audioContext && SoundManager.audioContext.state === 'suspended') {
            await SoundManager.audioContext.resume();
        }
        startLoop();
    }
});