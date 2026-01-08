// Base64 decoding
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decode Raw PCM to AudioBuffer (For Gemini)
export async function decodeRawPCM(
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const bytes = decodeBase64(base64Data);
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Decode standard audio files (MP3/WAV) to AudioBuffer (For ElevenLabs)
export async function decodeAudioFile(
  base64Data: string,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const bytes = decodeBase64(base64Data);
  // Copy to a fresh ArrayBuffer because decodeAudioData detaches the buffer
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return await ctx.decodeAudioData(arrayBuffer);
}

// Shared AudioContext (created on user interaction usually, but we can init lazily)
let audioContext: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000 // Match Gemini TTS default, though decodeAudioData will resample if needed
    });
  }
  return audioContext;
};

// --- Export Utilities ---

/**
 * Merges multiple AudioBuffers into a single AudioBuffer sequentially.
 */
export async function mergeAudioBuffers(buffers: AudioBuffer[]): Promise<AudioBuffer> {
  const ctx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1, // Output channels (mono is safer for mixed sources)
    1, // Temporary length, will be ignored by constructor but needed
    44100 // Standard export sample rate
  );

  // Calculate total duration
  const totalDuration = buffers.reduce((acc, b) => acc + b.duration, 0);
  const totalLength = Math.ceil(totalDuration * 44100);

  // Create the actual context with correct length
  const offlineCtx = new OfflineAudioContext(1, totalLength, 44100);

  let currentOffset = 0;
  for (const buffer of buffers) {
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(currentOffset);
    currentOffset += buffer.duration;
  }

  return await offlineCtx.startRendering();
}

/**
 * Encodes an AudioBuffer to a WAV Blob.
 */
export function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this encoder)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // clamp
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      // scale to 16-bit signed int
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArr], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

/**
 * Convert Blob to Base64 Data URL string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Encodes an AudioBuffer to MP3 format using @breezystack/lamejs
 * Falls back to WAV if MP3 encoding fails
 */
export async function bufferToMp3(buffer: AudioBuffer): Promise<Blob> {
  try {
    // Import the ES module compatible version of lamejs
    const { Mp3Encoder } = await import('@breezystack/lamejs');

    const mp3encoder = new Mp3Encoder(1, buffer.sampleRate, 128); // mono, sample rate, 128kbps
    const samples = buffer.getChannelData(0);

    // Convert Float32Array to Int16Array
    const sampleBlockSize = 1152; // must be multiple of 576
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const mp3Data: Uint8Array[] = [];

    // Encode in blocks
    for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
      const sampleChunk = int16Samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }

    // Flush remaining data
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    // Combine all chunks into one Uint8Array
    const totalLength = mp3Data.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of mp3Data) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return new Blob([result.buffer], { type: 'audio/mp3' });
  } catch (error) {
    console.warn('MP3 encoding failed, using WAV format instead:', error);
    // Fallback to WAV if MP3 encoding fails
    return bufferToWav(buffer);
  }
}

/**
 * Creates a WebM video with static image and audio using native browser APIs
 * @param audioBlob - Audio file (WAV)
 * @param imageBase64 - Base64 encoded cover image (PNG/JPG)
 * @param duration - Duration in seconds
 * @returns WebM video blob
 */
export interface WebmSegment {
  audioBuffer: AudioBuffer;
  imageBase64: string; // The specific image for this dialogue segment
  duration: number;
}

export type WebmResolution = '720p' | '1080p' | '4k';
export type WebmQuality = 'draft' | 'high' | 'ultra';

export interface WebmOptions {
  resolution?: WebmResolution;
  quality?: WebmQuality;
}

/**
 * Creates a dynamic WebM video with synchronized images and audio segments
 * @param segments - Array of audio/visual segments
 * @param defaultCover - Fallback image if a segment is missing one (optional)
 * @param options - Video resolution and quality settings
 * @returns WebM video blob
 */
export async function createDynamicWebmVideo(
  segments: WebmSegment[],
  defaultCover?: string,
  options: WebmOptions = {}
): Promise<Blob> {
  const { resolution = '1080p', quality = 'high' } = options;

  // Resolve resolution
  let width = 1920;
  let height = 1080;
  switch (resolution) {
    case '720p': width = 1280; height = 720; break;
    case '1080p': width = 1920; height = 1080; break;
    case '4k': width = 3840; height = 2160; break;
  }

  // Resolve bitrate
  let bitrate = 8000000; // 8 Mbps default
  switch (quality) {
    case 'draft': bitrate = 2500000; break; // 2.5 Mbps
    case 'high': bitrate = 8000000; break; // 8 Mbps
    case 'ultra': bitrate = 16000000; break; // 16 Mbps
  }

  // 1. Setup Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 2. Setup Audio Context & Destination
  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();

  // 3. Pre-load all images to avoid loading delay during recording
  // Map base64 -> HTMLImageElement
  const imageCache = new Map<string, HTMLImageElement>();
  const uniqueImages = new Set<string>();

  if (defaultCover) uniqueImages.add(defaultCover);
  segments.forEach(s => {
    if (s.imageBase64) uniqueImages.add(s.imageBase64);
  });

  await Promise.all(Array.from(uniqueImages).map(async (base64) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = `data:image/png;base64,${base64}`;
    });
    imageCache.set(base64, img);
  }));

  // Helper to draw image
  const drawImage = (base64: string) => {
    const img = imageCache.get(base64) || (defaultCover ? imageCache.get(defaultCover) : null);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Clear

    if (img) {
      // Draw image centered and scaled to fit
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    }
  };

  // 4. Setup MediaRecorder
  const canvasStream = canvas.captureStream(30); // 30 FPS for smoother transitions
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks()
  ]);

  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: 'video/webm;codecs=vp9,opus',
    videoBitsPerSecond: bitrate
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>(async (resolve, reject) => {
    mediaRecorder.onstop = () => {
      const videoBlob = new Blob(chunks, { type: 'video/webm' });
      audioContext.close();
      resolve(videoBlob);
    };
    mediaRecorder.onerror = (e) => {
      audioContext.close();
      reject(e);
    };

    // Start Recording
    mediaRecorder.start();

    // 5. Play segments sequentially
    try {
      // Draw first image immediately
      if (segments.length > 0) {
        drawImage(segments[0].imageBase64);
      }

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        // Draw current image
        drawImage(segment.imageBase64);

        // Play audio
        const source = audioContext.createBufferSource();
        source.buffer = segment.audioBuffer;
        source.connect(audioDestination);
        source.start();

        // Wait for duration
        // We use a slightly safer wait logic to ensure audio completes
        await new Promise(r => setTimeout(r, segment.duration * 1000));
      }

      // Allow a tiny buffer at the end
      await new Promise(r => setTimeout(r, 500));
      mediaRecorder.stop();

    } catch (err) {
      mediaRecorder.stop();
      reject(err);
    }
  });
}

/**
 * Legacy wrapper for backward compatibility or single-image video
 */
export async function createWebmVideo(
  audioBlob: Blob,
  imageBase64: string,
  duration: number
): Promise<Blob> {
  // Decode audio blob simply to get a buffer
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
  audioContext.close();

  return createDynamicWebmVideo([{
    audioBuffer,
    imageBase64,
    duration
  }], imageBase64);
}