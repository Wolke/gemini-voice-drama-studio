
export enum ItemType {
  SPEECH = 'speech',
  SFX = 'sfx',
}

export type LlmProvider = 'gemini';

// TTS Provider types - now managed by lib/tts registry
// Import the dynamic type from the registry module
import { TtsProviderId } from './lib/tts';
export type TtsProvider = TtsProviderId;
export type VoiceType = TtsProviderId;

export type ImageProvider = 'gemini';


// Available Gemini models for script generation
export const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
] as const;
export type GeminiModel = typeof GEMINI_MODELS[number];



// ============ 影像生成設定 ============

// 影像輸出格式 (aspect ratio)
export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export const IMAGE_ASPECT_RATIOS: { value: ImageAspectRatio; label: string; useCase: string }[] = [
  { value: '1:1', label: 'Square (1:1)', useCase: 'Instagram, Podcast Cover' },
  { value: '16:9', label: 'Landscape (16:9)', useCase: 'YouTube, Desktop' },
  { value: '9:16', label: 'Portrait (9:16)', useCase: 'YouTube Shorts, IG Reels' },
  { value: '4:3', label: 'Traditional (4:3)', useCase: 'Traditional Screens' },
  { value: '3:4', label: 'Vertical (3:4)', useCase: 'Social Media Vertical' },
];

// 影像風格預設
export type ImageStylePreset = 'anime' | 'realistic' | 'watercolor' | 'cartoon' | 'cinematic' | 'custom';

export const IMAGE_STYLE_PRESETS: { value: ImageStylePreset; label: string; promptSuffix: string }[] = [
  { value: 'anime', label: 'Anime', promptSuffix: 'anime style, vibrant colors, detailed' },
  { value: 'realistic', label: 'Realistic', promptSuffix: 'photorealistic, highly detailed, professional photography' },
  { value: 'watercolor', label: 'Watercolor', promptSuffix: 'watercolor painting style, soft colors, artistic' },
  { value: 'cartoon', label: 'Cartoon', promptSuffix: 'cartoon style, bold outlines, colorful' },
  { value: 'cinematic', label: 'Cinematic', promptSuffix: 'cinematic lighting, movie still, dramatic' },
  { value: 'custom', label: 'Custom', promptSuffix: '' },
];

// 影像生成模型
// 影像生成模型
export const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
] as const;
export type GeminiImageModel = typeof GEMINI_IMAGE_MODELS[number];

export const IMAGE_MODELS = [
  ...GEMINI_IMAGE_MODELS,
] as const;
export type ImageModel = typeof IMAGE_MODELS[number];

// ============ 對話視覺生成設定 ============

// 對話視覺生成模式
export type DialogueVisualMode = 'compose' | 'veo';

// Veo 影片模型 (預留)
export const VEO_MODELS = [
  'veo-3.1-generate-preview',
  'veo-3.1-fast-generate-preview',
  'veo-3.0-generate-001',
] as const;
export type VeoModel = typeof VEO_MODELS[number];

// 影片解析度 (預留)
export type VideoResolution = '720p' | '1080p';

// 影片長度 (預留)
export type VideoDuration = 4 | 5 | 6 | 8;

// 角色參考圖
export interface CharacterRef {
  name: string;
  imageBase64: string;
}


export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

export interface CastMember {
  name: string;
  voice: string; // Gemini voice name OR ElevenLabs display name
  voiceType: VoiceType; // Source of the voice
  elevenLabsVoiceId?: string; // ElevenLabs Voice ID (when voiceType is 'elevenlabs')
  description?: string;
  voicePrompt?: string; // Accent/style prompt for TTS, e.g. "Native Taiwanese Mandarin, cheerful"
  // 角色影像
  imagePrompt?: string;      // AI 生成用 prompt (角色外觀描述)
  imageBase64?: string;      // 生成或上傳的圖片 (base64)
  isCustomImage?: boolean;   // 是否為使用者上傳的自訂圖片
}

export interface SceneDefinition {
  id: string;
  name: string;
  visualDescription: string;
  // 場景影像
  imagePrompt?: string;        // AI 生成用 prompt
  imageBase64?: string;        // 生成或上傳的圖片 (base64)
  isCustomImage?: boolean;     // 是否為使用者上傳
  // 場景中出現的角色 (參照 CastMember.name)
  characterNames?: string[];
}

export interface ScriptItem {
  id: string;
  type: ItemType;
  character?: string;   // 參照 CastMember.name
  text?: string;
  expression?: string; // e.g., "excited", "whispering"
  location?: string; // 參照 SceneDefinition.name
  sfxDescription?: string;
  sceneCharacters?: string[]; // 該時刻場景中的角色（不含旁白）

  // Audio state
  audioBuffer?: AudioBuffer | null;
  isLoadingAudio?: boolean;
  generationError?: string; // Capture API errors here

  // For batch mode: reference to stored audio in IndexedDB
  audioKey?: string;  // IndexedDB key for audio base64
  audioFormat?: 'mp3' | 'pcm';  // Format for decoding

  // 對話影像 (每個對話/音效都可以有專屬畫面)
  imagePrompt?: string;       // 此刻畫面的 prompt (動作/情緒描述)
  imageBase64?: string;       // 生成或上傳的圖片
  isCustomImage?: boolean;    // 是否為使用者上傳
  isLoadingImage?: boolean;   // 圖片生成中

  // AI 影片 (預留 Veo)
  videoBase64?: string;       // AI 生成的影片
  isLoadingVideo?: boolean;   // 影片生成中
}

export interface CharacterVoice {
  name: string;
  voiceName: string;
}

// Auto-generated Podcast metadata from script generation
export interface GeneratedPodcastInfo {
  podcastName: string;        // Podcast 名稱
  author: string;             // 作者
  episodeTitle: string;       // 本集標題
  description: string;        // Podcast 描述
  coverPrompt: string;        // 封面圖生成提示
  tags?: string[];            // 標籤
}

export interface DramaState {
  storyText: string;
  cast: CastMember[];
  scenes: SceneDefinition[];
  items: ScriptItem[];
  isGeneratingScript: boolean;
  isPlaying: boolean;
  currentPlayingId: string | null;

  // Configuration
  enableSfx: boolean;
  includeNarrator: boolean;
  geminiApiKey: string;
  elevenLabsApiKey: string;
  useElevenLabsForSpeech: boolean;

  llmProvider: LlmProvider;
  ttsProvider: TtsProvider;

  // Model selection
  geminiModel: GeminiModel;

  // ElevenLabs voices cache
  elevenLabsVoices: ElevenLabsVoice[];
  isLoadingVoices: boolean;

  // Auto-generated Podcast info
  podcastInfo: GeneratedPodcastInfo | null;

  // Timestamp when the script was last generated
  scriptGenerationTimestamp?: number;

  // ============ 影像生成設定 ============
  imageAspectRatio: ImageAspectRatio;
  imageStylePreset: ImageStylePreset;
  customImageStyle: string;           // 自訂風格文字 (當 imageStylePreset='custom' 時使用)
  enableDialogueImages: boolean;      // 是否為每個對話生成獨立畫面
  imageModel: ImageModel;             // 影像生成模型
  imageProvider: ImageProvider;       // 影像生成服務商

  // ============ 對話視覺生成設定 ============
  dialogueVisualMode: DialogueVisualMode;  // 'compose' | 'veo'
  veoModel: VeoModel;                      // 預留：Veo 模型
  veoResolution: VideoResolution;          // 預留：影片解析度
  veoDuration: VideoDuration;              // 預留：影片長度
}


