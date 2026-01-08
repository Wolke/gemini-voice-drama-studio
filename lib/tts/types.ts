/**
 * TTS Provider Types
 * Defines the interface for all TTS providers
 */

/**
 * Voice definition for a TTS provider
 */
export interface TtsVoice {
    id: string;           // Provider-specific voice ID
    name: string;         // Display name
    language?: string;    // e.g., 'zh-TW', 'nan-TW' (台語), 'hak-TW' (客家語)
    gender?: 'male' | 'female' | 'neutral';
    preview_url?: string; // Voice sample URL
    labels?: Record<string, string>; // Additional metadata
}

/**
 * Speech generation options
 */
export interface SpeechOptions {
    text: string;
    voiceId: string;
    voiceName?: string;     // Display name for fallback
    voicePrompt?: string;   // Accent/style hint
    expression?: string;    // Emotion/tone
}

/**
 * Speech generation result
 */
export interface SpeechResult {
    audioBase64: string;
    format: 'mp3' | 'pcm' | 'wav';  // For correct decoding
}

/**
 * Configuration field for provider settings UI
 */
export interface ConfigField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'select';
    required: boolean;
    placeholder?: string;
    options?: { value: string; label: string }[]; // For select type
}

/**
 * TTS Provider interface - all providers must implement this
 */
export interface TtsProvider {
    /** Unique provider ID */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Provider description */
    readonly description?: string;

    /** Supported languages (ISO codes like 'zh-TW', 'nan-TW', 'hak-TW') */
    readonly languages: string[];

    /** Configuration fields for settings UI */
    readonly configFields: ConfigField[];

    /** Check if provider is configured and ready */
    isConfigured(config: Record<string, string>): boolean;

    /** Fetch available voices (can be async for API-based providers) */
    getVoices(config: Record<string, string>): Promise<TtsVoice[]>;

    /** Generate speech from text */
    generateSpeech(options: SpeechOptions, config: Record<string, string>): Promise<SpeechResult>;
}

/**
 * Configuration store type - maps config keys to values
 */
export type TtsConfig = Record<string, string>;
