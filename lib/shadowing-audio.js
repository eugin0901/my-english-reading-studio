export const RECORDING_SECONDS = 45;
export const RECORDING_SAMPLE_RATE = 16_000;

export function encodeMonoWav(buffer) {
  const length = Math.min(buffer.length, RECORDING_SECONDS * RECORDING_SAMPLE_RATE);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const output = new ArrayBuffer(44 + length * 2);
  const view = new DataView(output);
  const writeText = (offset, value) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, output.byteLength - 8, true);
  writeText(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RECORDING_SAMPLE_RATE, true);
  view.setUint32(28, RECORDING_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, length * 2, true);

  for (let index = 0; index < length; index++) {
    let sum = 0;
    for (const channel of channels) sum += channel[index];
    const sample = Math.max(-1, Math.min(1, sum / channels.length));
    view.setInt16(44 + index * 2, sample * (sample < 0 ? 0x8000 : 0x7fff), true);
  }
  return new Blob([output], { type: 'audio/wav' });
}
