/**
 * ElevenLabs TTS Provider
 */

import { TtsProvider, TtsVoice, SpeechOptions, SpeechResult, TtsConfig } from '../types';

export const elevenLabsProvider: TtsProvider = {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'High-quality AI voices with voice cloning support',
    languages: ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'hi', 'ar'],

    configFields: [
        {
            key: 'elevenLabsApiKey',
            label: 'ElevenLabs API Key',
            type: 'password',
            required: true,
            placeholder: '輸入 ElevenLabs API Key...'
        }
    ],

    isConfigured(config: TtsConfig): boolean {
        return !!config.elevenLabsApiKey;
    },

    async getVoices(config: TtsConfig): Promise<TtsVoice[]> {
        const { fetchElevenLabsVoices } = await import('../../../services/elevenLabsService');

        try {
            const voices = await fetchElevenLabsVoices(config.elevenLabsApiKey);
            return voices.map(v => ({
                id: v.voice_id,
                name: v.name,
                language: 'multi',
                labels: v.labels,
                preview_url: v.preview_url,
            }));
        } catch (e) {
            console.error('[ElevenLabs Provider] Failed to fetch voices:', e);
            return [];
        }
    },

    async generateSpeech(options: SpeechOptions, config: TtsConfig): Promise<SpeechResult> {
        const { generateElevenLabsSpeech } = await import('../../../services/elevenLabsService');

        const base64 = await generateElevenLabsSpeech(
            options.text,
            options.voiceId,           // voice_id
            options.voiceName || options.voiceId,  // voice name fallback
            options.voicePrompt,
            config.elevenLabsApiKey
        );

        return {
            audioBase64: base64,
            format: 'mp3'  // ElevenLabs returns MP3
        };
    }
};
