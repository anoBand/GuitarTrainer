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

        // 볼륨 분석을 위한 Analyser 노드 연결
        const source = audioContext.createMediaStreamSource(micStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Pitch 모델 로드
        const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';

        return new Promise((resolve) => {
            pitch = ml5.pitchDetection(modelUrl, audioContext, micStream, () => {
                console.log("Model Loaded via Device:", deviceId || "Default");
                isAudioStarted = true;
                resolve();
            });
        });
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