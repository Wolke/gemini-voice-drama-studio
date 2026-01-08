/**
 * TTS Provider Registry
 * Centralized management for all TTS providers
 */

import { TtsProvider, TtsVoice, SpeechOptions, SpeechResult, TtsConfig } from './types';

class TtsRegistry {
    private providers: Map<string, TtsProvider> = new Map();

    /**
     * Register a TTS provider
     */
    register(provider: TtsProvider): void {
        if (this.providers.has(provider.id)) {
            console.warn(`[TTS Registry] Provider "${provider.id}" already registered, overwriting.`);
        }
        this.providers.set(provider.id, provider);
        console.log(`[TTS Registry] Registered provider: ${provider.id} (${provider.name})`);
    }

    /**
     * Unregister a provider (for dynamic loading scenarios)
     */
    unregister(id: string): boolean {
        return this.providers.delete(id);
    }

    /**
     * Get provider by ID
     */
    get(id: string): TtsProvider | undefined {
        return this.providers.get(id);
    }

    /**
     * Get all registered providers
     */
    listAll(): TtsProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Get providers that support a specific language
     */
    getByLanguage(lang: string): TtsProvider[] {
        return this.listAll().filter(p => p.languages.includes(lang));
    }

    /**
     * Get all provider IDs
     */
    getProviderIds(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Check if a provider exists
     */
    has(id: string): boolean {
        return this.providers.has(id);
    }

    /**
     * Check if a provider is configured
     */
    isProviderConfigured(id: string, config: TtsConfig): boolean {
        const provider = this.get(id);
        return provider?.isConfigured(config) ?? false;
    }

    /**
     * Get voices for a specific provider
     */
    async getVoices(providerId: string, config: TtsConfig): Promise<TtsVoice[]> {
        const provider = this.get(providerId);
        if (!provider) {
            console.warn(`[TTS Registry] Provider not found: ${providerId}`);
            return [];
        }
        if (!provider.isConfigured(config)) {
            console.warn(`[TTS Registry] Provider ${providerId} is not configured`);
            return [];
        }
        return provider.getVoices(config);
    }

    /**
     * Generate speech using specified provider
     */
    async generateSpeech(
        providerId: string,
        options: SpeechOptions,
        config: TtsConfig
    ): Promise<SpeechResult> {
        const provider = this.get(providerId);
        if (!provider) {
            throw new Error(`[TTS Registry] Provider not found: ${providerId}`);
        }
        if (!provider.isConfigured(config)) {
            throw new Error(`[TTS Registry] Provider "${provider.name}" is not configured. Please add required API keys.`);
        }
        return provider.generateSpeech(options, config);
    }

    /**
     * Get configured providers only
     */
    getConfiguredProviders(config: TtsConfig): TtsProvider[] {
        return this.listAll().filter(p => p.isConfigured(config));
    }
}

// Singleton instance
export const ttsRegistry = new TtsRegistry();
