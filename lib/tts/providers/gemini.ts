/**
 * Gemini TTS Provider
 */

import { TtsProvider, TtsVoice, SpeechOptions, SpeechResult, TtsConfig } from '../types';

// All available Gemini TTS voices
const GEMINI_VOICES = [
    "Zephyr", "Puck", "Charon", "Kore", "Fenrir",
    "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
    "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina",
    "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
    "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird",
    "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"
];

export const geminiProvider: TtsProvider = {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini AI voices with multi-language support',
    languages: ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt'],

    configFields: [
        {
            key: 'geminiApiKey',
            label: 'Gemini API Key',
            type: 'password',
            required: true,
            placeholder: '輸入 Gemini API Key...'
        }
    ],

    isConfigured(config: TtsConfig): boolean {
        return !!config.geminiApiKey;
    },

    async getVoices(): Promise<TtsVoice[]> {
        return GEMINI_VOICES.map(name => ({
            id: name,
            name: name,
            language: 'multi',
        }));
    },

    async generateSpeech(options: SpeechOptions, config: TtsConfig): Promise<SpeechResult> {
        // Dynamic import to avoid circular dependencies
        const { generateSpeech } = await import('../../../services/geminiService');

        const base64 = await generateSpeech(
            options.text,
            options.voiceId,
            options.voicePrompt || '',
            options.expression || '',
            config.geminiApiKey
        );

        return {
            audioBase64: base64,
            format: 'pcm'  // Gemini returns raw PCM
        };
    }
};

// Export voice list for backward compatibility
export const GEMINI_VOICE_LIST = GEMINI_VOICES;
