/**
 * TTS Module - Public API
 * 
 * This module provides a unified interface for Text-to-Speech providers.
 * To add a new provider, create a file in ./providers/ and register it here.
 */

// Re-export types
export * from './types';

// Export registry
export { ttsRegistry } from './registry';

// Import providers
import { geminiProvider, GEMINI_VOICE_LIST } from './providers/gemini';
import { elevenLabsProvider } from './providers/elevenlabs';

// Import registry
import { ttsRegistry } from './registry';

// Register built-in providers
ttsRegistry.register(geminiProvider);
ttsRegistry.register(elevenLabsProvider);

// Export voice lists for backward compatibility
export { GEMINI_VOICE_LIST };

// Export individual providers for direct access if needed
export { geminiProvider, elevenLabsProvider };

/**
 * Helper: Get the current TTS provider type as a union type
 * This provides type safety when working with provider IDs
 */
export type TtsProviderId = 'gemini' | 'elevenlabs';

// Note: When adding a new provider:
// 1. Create lib/tts/providers/your-provider.ts
// 2. Import and register it here: ttsRegistry.register(yourProvider)
// 3. Add the ID to TtsProviderId type above
// That's it! The UI will automatically show the new provider.
