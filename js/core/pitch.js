// js/core/pitch.js

let audioContext;
let pitch;
let micStream;
let isAudioStarted = false;

/**
 * 마이크를 켜고 ml5 모델을 로드합니다.
 */
export async function startAudio() {
    if (isAudioStarted) return;

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // 모델 경로 (ml5 CDN)
        const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';

        return new Promise((resolve) => {
            pitch = ml5.pitchDetection(modelUrl, audioContext, micStream, () => {
                console.log("Pitch Model Loaded");
                isAudioStarted = true;
                resolve();
            });
        });
    } catch (err) {
        console.error("Audio Init Error:", err);
        alert("마이크 접근 권한이 필요합니다.");
    }
}

/**
 * 현재 피치를 감지하여 콜백으로 전달합니다.
 */
export function getPitch(callback) {
    if (!pitch || !isAudioStarted) return;

    pitch.getPitch((err, frequency) => {
        if (frequency) {
            callback(frequency);
        } else {
            callback(null); // 소리 없음
        }
    });
}