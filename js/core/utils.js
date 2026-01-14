// js/core/utils.js

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 주파수(Hz)를 받아 노트 정보 객체를 반환합니다.
 */
export function getNoteFromFreq(frequency) {
    // 440Hz = A4
    // MIDI Note Number 계산
    const noteNum = 12 * (Math.log2(frequency / 440)) + 69;

    // 반올림하여 가장 가까운 정수 노트 찾기
    const noteNumRounded = Math.round(noteNum);

    // 노트 인덱스 (0=C, 1=C#, ...)
    const noteIndex = noteNumRounded % 12;

    // 옥타브 (MIDI 60 = C4)
    const octave = Math.floor(noteNumRounded / 12) - 1;

    // 정확한 목표 주파수(Target Frequency)
    const targetFreq = 440 * Math.pow(2, (noteNumRounded - 69) / 12);

    // 센트(Cents) 오차 계산 (100 cents = 1 semitone)
    const cents = 1200 * Math.log2(frequency / targetFreq);

    return {
        note: NOTES[noteIndex],   // "A", "C#"
        octave: octave,           // 2, 3, 4
        cents: cents,             // -5.23, +12.0
        frequency: frequency      // 입력받은 주파수
    };
}