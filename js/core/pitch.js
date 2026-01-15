// js/core/pitch.js

let audioContext;
let pitch;
let micStream;
let analyser;
let dataArray;
let isAudioStarted = false;

// 사용 가능한 오디오 입력 장치 목록 반환
export async function getAudioDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true }); // 권한 요청용
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'audioinput');
    } catch (err) {
        console.error("Device Enumeration Error:", err);
        return [];
    }
}

// 오디오 시작 (특정 장치 ID 지원)
export async function startAudio(deviceId = null) {
    if (isAudioStarted) return;

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const constraints = {
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false, // 기타 소리 왜곡 방지
                deviceId: deviceId ? { exact: deviceId } : undefined
            }
        };

        micStream = await navigator.mediaDevices.getUserMedia(constraints);

        // [수정 시작] 오디오 전처리 (필터 & 컴프레서) 추가
        const source = audioContext.createMediaStreamSource(micStream);

        // 1. 하이패스 필터: 70Hz 이하의 웅웅거리는 저음 노이즈 제거 (E2=82Hz 인식 개선)
        const highPass = audioContext.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 75;

        // 2. 로우패스 필터: 3000Hz 이상의 날카로운 고주파 잡음 제거
        const lowPass = audioContext.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 3000;

        // 3. 다이내믹 컴프레서: 작은 소리(하이프렛, 약한 저음)를 증폭시켜 인식률 향상
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -50; // 낮은 레벨부터 압축 시작
        compressor.knee.value = 40;
        compressor.ratio.value = 12;      // 압축 비율
        compressor.attack.value = 0;
        compressor.release.value = 0.25;

        // 처리된 오디오를 ml5로 보내기 위한 목적지 생성
        const destination = audioContext.createMediaStreamDestination();

        // 연결 순서: 마이크 -> 하이패스 -> 로우패스 -> 컴프레서 -> 목적지
        source.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(compressor);
        compressor.connect(destination);

        // 볼륨 분석을 위한 Analyser 노드 연결 (처리된 오디오 사용)
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // [수정] 256 -> 2048 (해상도를 높여 저음 분석 정확도 향상)
        compressor.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Pitch 모델 로드
        const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';

        return new Promise((resolve) => {
            // [중요] micStream 대신 처리된 오디오 스트림(destination.stream)을 전달
            pitch = ml5.pitchDetection(modelUrl, audioContext, destination.stream, () => {
                console.log("Model Loaded via Device:", deviceId || "Default");
                isAudioStarted = true;
                resolve();
            });
        });
        // [수정 끝]
    } catch (err) {
        console.error("Audio Init Error:", err);
        alert("마이크 연결 실패: " + err.message);
    }
}

export function getPitch(callback) {
    if (!pitch || !isAudioStarted) return;

    // 1. 볼륨(RMS) 계산
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const x = (dataArray[i] - 128) / 128.0;
        sum += x * x;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // 2. 피치 감지
    pitch.getPitch((err, frequency) => {
        // frequency와 함께 현재 볼륨(rms)도 전달
        callback(frequency, rms);
    });
}