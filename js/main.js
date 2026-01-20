// js/main.js
import { startAudio, getPitch, getAudioDevices } from './core/pitch.js';
import { TunerApp } from './tuner/tunerApp.js';
import { FretboardGame } from './fretboard/game.js';
import { VirtualFretboard } from './fretboard/virtualFretboard.js';
import { SoundManager } from './core/sound.js';

const tuner = new TunerApp();
const game = new FretboardGame();
let currentMode = 'tuner';
let animationFrameId = null; // 루프 제어용 ID
let isLoopRunning = false;   // 루프 상태 플래그

// [NEW] 가상 프렛보드 초기화 (클릭 시 game 인스턴스에 전달)
const vFretboard = new VirtualFretboard('virtual-fretboard', (note, string) => {
    if (currentMode === 'game') {
        game.handleVirtualClick(note, string);
    }
});

// --- 1. 오디오 초기화 ---
const btnInit = document.getElementById('btn-init');
const overlay = document.getElementById('start-overlay');

btnInit.addEventListener('click', async () => {
    btnInit.innerText = "연결 중...";
    try {
        await startAudio();
        overlay.style.display = 'none';

        // 오디오 시작 후 루프 가동
        startLoop();
    } catch (err) {
        console.error("Audio init failed:", err);
        btnInit.innerText = "오류 발생 (재시도)";
    }
});

/* =========================================
   테마 변경 로직 (Dark/Light Toggle)
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

// [NEW] 볼륨 슬라이더 기능
const volSlider = document.getElementById('volume-slider');
if (volSlider) {
    volSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        SoundManager.setVolume(val);
        // 피드백 사운드는 너무 자주 울리지 않도록 디바운스 처리 추천 (여기선 단순화)
        // SoundManager.playTone(440, 'sine', 0.1);
    });
}

// --- 2. ⚙️ 설정 모달 로직 (기어 아이콘) ---
const btnSettings = document.getElementById('btn-settings');
const modal = document.getElementById('settings-modal');
const modalSelect = document.getElementById('modal-audio-source');
const btnSave = document.getElementById('btn-save-settings');
const btnClose = document.getElementById('btn-close-settings');

if (btnSettings) {
    btnSettings.addEventListener('click', async () => {
        modal.showModal();
        const devices = await getAudioDevices();
        modalSelect.innerHTML = '';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Mic ${modalSelect.length + 1}`;
            modalSelect.add(option);
        });
    });
}

if (btnSave) {
    btnSave.addEventListener('click', async () => {
        const selectedDeviceId = modalSelect.value;
        if (selectedDeviceId) {
            // 장치 변경 시 기존 루프 잠시 중단 후 재시작 권장
            stopLoop();
            await startAudio(selectedDeviceId);
            startLoop();
        }
        modal.close();
    });
}

if (btnClose) btnClose.addEventListener('click', () => modal.close());


// --- 3. 탭 전환 ---
const navTuner = document.getElementById('nav-tuner');
const navGame = document.getElementById('nav-fretboard');
const secTuner = document.getElementById('tuner-app');
const secGame = document.getElementById('fretboard-app');

if (navTuner && navGame) {
    navTuner.addEventListener('click', () => switchTab('tuner'));
    navGame.addEventListener('click', () => switchTab('game'));
}

function switchTab(mode) {
    currentMode = mode;
    if (mode === 'tuner') {
        navTuner.classList.add('active');
        navGame.classList.remove('active');
        secTuner.classList.remove('hidden');
        secGame.classList.add('hidden');
        game.stopGame();
    } else {
        navGame.classList.add('active');
        navTuner.classList.remove('active');
        secGame.classList.remove('hidden');
        secTuner.classList.add('hidden');
    }
}

// --- 4. 메인 루프 (최적화 적용) ---

function loop() {
    if (!isLoopRunning) return; // 플래그가 꺼지면 실행 중단

    getPitch((frequency, volume) => {
        if (currentMode === 'tuner') {
            tuner.update(frequency);
        } else {
            game.update(frequency, volume);
        }
    });

    animationFrameId = requestAnimationFrame(loop);
}

function startLoop() {
    if (isLoopRunning) return; // 이미 실행 중이면 중복 실행 방지
    isLoopRunning = true;
    loop();
    console.log("Game Loop Started");
}

function stopLoop() {
    isLoopRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    console.log("Game Loop Stopped");
}


/* =========================================
   [최적화] 탭 전환 / 백그라운드 처리
   ========================================= */
document.addEventListener("visibilitychange", async () => {
    if (document.hidden) {
        // [1] 탭이 가려지면: 루프를 완전히 멈춰서 CPU/배터리 절약 및 프레임 적체 방지
        stopLoop();

        // (선택사항) 게임이 진행 중이었다면 일시정지 로직 추가 가능
        // if (game.isPlaying && game.mode !== 'free') { ... }

    } else {
        // [2] 탭이 다시 보이면:

        // A. 오디오 컨텍스트 깨우기 (Resume AudioContext)
        // 브라우저는 비활성 탭의 오디오를 'Suspended' 상태로 만듭니다.
        if (SoundManager.audioContext && SoundManager.audioContext.state === 'suspended') {
            await SoundManager.audioContext.resume();
        }

        // B. 오디오 엔진 예열 (Warm-up)
        // 아주 짧은 무음을 재생하여 오디오 출력 지연(Latency)을 초기화합니다.
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const tempCtx = new AudioContext();
                const osc = tempCtx.createOscillator();
                const gain = tempCtx.createGain();
                gain.gain.value = 0.0001; // 들리지 않는 소리
                osc.connect(gain);
                gain.connect(tempCtx.destination);
                osc.start();
                osc.stop(tempCtx.currentTime + 0.01);
                setTimeout(() => tempCtx.close(), 100);
            }
        } catch (e) {
            // 무시 (오디오 권한 이슈 등)
        }

        // C. 루프 재개
        startLoop();

        // D. 화면 강제 갱신 (리페인트 유도)
        requestAnimationFrame(() => {
            document.body.style.opacity = '0.99';
            requestAnimationFrame(() => document.body.style.opacity = '1');
        });
    }
});