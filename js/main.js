// js/main.js
import { startAudio, getPitch, getAudioDevices } from './core/pitch.js';
import { TunerApp } from './tuner/tunerApp.js';
import { FretboardGame } from './fretboard/game.js';
import { VirtualFretboard } from './fretboard/virtualFretboard.js';
import { SoundManager } from './core/sound.js';

const tuner = new TunerApp();
const game = new FretboardGame();
let currentMode = 'tuner';

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
    // 초기에는 기본 장치로 시작하거나, 이전에 저장된 ID가 있다면 그것을 사용 가능
    await startAudio();
    overlay.style.display = 'none';
    startLoop();
});

const btnTheme = document.getElementById('btn-theme');
btnTheme.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    // 아이콘 변경 (선택사항)
    btnTheme.innerText = document.body.classList.contains('light-mode') ? '🌑' : '🌗';
});

// [NEW] 볼륨 슬라이더 기능
const volSlider = document.getElementById('volume-slider');
volSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    SoundManager.setVolume(val);
    SoundManager.playTone(440, 'sine', 0.1);
});

// --- 2. ⚙️ 설정 모달 로직 (기어 아이콘) ---
const btnSettings = document.getElementById('btn-settings');
const modal = document.getElementById('settings-modal');
const modalSelect = document.getElementById('modal-audio-source');
const btnSave = document.getElementById('btn-save-settings');
const btnClose = document.getElementById('btn-close-settings');

// 설정 열기
btnSettings.addEventListener('click', async () => {
    modal.showModal();
    // 장치 목록 갱신
    const devices = await getAudioDevices();
    modalSelect.innerHTML = '';
    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Mic ${modalSelect.length + 1}`;
        modalSelect.add(option);
    });
});

// 설정 저장 (장치 변경)
btnSave.addEventListener('click', async () => {
    const selectedDeviceId = modalSelect.value;
    if (selectedDeviceId) {
        // 기존 스트림 닫고 새로 시작하는 로직은 startAudio 내부 혹은 별도 처리 필요하지만,
        // 여기서는 간단히 페이지 리로드 없이 오디오 컨텍스트 재시작 호출
        // (실제로는 stopAudio 구현이 필요하나, startAudio 재호출로 덮어쓰기 시도)
        await startAudio(selectedDeviceId);
    }
    modal.close();
});

btnClose.addEventListener('click', () => modal.close());


// --- 3. 탭 전환 ---
const navTuner = document.getElementById('nav-tuner');
const navGame = document.getElementById('nav-fretboard');
const secTuner = document.getElementById('tuner-app');
const secGame = document.getElementById('fretboard-app');

navTuner.addEventListener('click', () => switchTab('tuner'));
navGame.addEventListener('click', () => switchTab('game'));

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

// --- 4. 메인 루프 ---
function startLoop() {
    function loop() {
        getPitch((frequency, volume) => {
            if (currentMode === 'tuner') {
                tuner.update(frequency);
            } else {
                game.update(frequency, volume);
            }
        });
        requestAnimationFrame(loop);
    }
    loop();
}