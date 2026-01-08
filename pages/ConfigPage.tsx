/**
 * ConfigPage Component
 * API Keys and settings management
 */

import React from 'react';
import {
    Key, Save, RefreshCw, ToggleRight, ToggleLeft,
    Mic2, Speaker, Volume2, Wand2, Loader2, Youtube,
    LogIn, LogOut, Image, Palette, Cpu, Sparkles
} from 'lucide-react';
import {
    LlmProvider, TtsProvider, GeminiModel,
    GEMINI_MODELS, ElevenLabsVoice,
    ImageAspectRatio, ImageStylePreset, ImageModel, ImageProvider,
    IMAGE_ASPECT_RATIOS, IMAGE_STYLE_PRESETS, IMAGE_MODELS,
    GEMINI_IMAGE_MODELS,
    DialogueVisualMode, VeoModel, VideoResolution, VideoDuration, VEO_MODELS
} from '../types';
import { YouTubeChannel, YouTubePlaylist } from '../services/youtubeService';

// Import TTS registry for dynamic provider list
import { ttsRegistry } from '../lib/tts';


interface ConfigPageProps {
    // API Keys
    geminiApiKey: string;
    setGeminiApiKey: (key: string) => void;
    saveGeminiKey: boolean;
    setSaveGeminiKey: (save: boolean) => void;

    elevenLabsApiKey: string;
    setElevenLabsApiKey: (key: string) => void;
    saveElevenLabsKey: boolean;
    setSaveElevenLabsKey: (save: boolean) => void;

    // ElevenLabs voices
    elevenLabsVoices: ElevenLabsVoice[];
    isLoadingVoices: boolean;
    onFetchVoices: () => void;


    // Provider selection
    llmProvider: LlmProvider;
    setLlmProvider: (provider: LlmProvider) => void;
    ttsProvider: TtsProvider;
    setTtsProvider: (provider: TtsProvider) => void;

    // Model selection
    geminiModel: GeminiModel;
    setGeminiModel: (model: GeminiModel) => void;

    // Feature toggles
    enableSfx: boolean;
    setEnableSfx: (enable: boolean) => void;
    includeNarrator: boolean;
    setIncludeNarrator: (include: boolean) => void;
    useElevenLabsForSpeech: boolean;
    setUseElevenLabsForSpeech: (use: boolean) => void;

    // YouTube
    youtubeClientId: string;
    setYoutubeClientId: (id: string) => void;
    saveYoutubeClientId: boolean;
    setSaveYoutubeClientId: (save: boolean) => void;
    isYouTubeLoggedIn: boolean;
    isLoadingYouTube: boolean;
    onYouTubeLogin: () => void;
    onYouTubeLogout: () => void;
    youtubeChannels: YouTubeChannel[];
    selectedChannelId: string;
    setSelectedChannelId: (id: string) => void;
    youtubePlaylists: YouTubePlaylist[];
    selectedPlaylistId: string;
    setSelectedPlaylistId: (id: string) => void;

    // 影像生成設定
    imageAspectRatio: ImageAspectRatio;
    setImageAspectRatio: (ratio: ImageAspectRatio) => void;
    imageStylePreset: ImageStylePreset;
    setImageStylePreset: (preset: ImageStylePreset) => void;
    customImageStyle: string;
    setCustomImageStyle: (style: string) => void;
    enableDialogueImages: boolean;
    setEnableDialogueImages: (enable: boolean) => void;
    imageModel: ImageModel;
    setImageModel: (model: ImageModel) => void;
    imageProvider: ImageProvider;
    setImageProvider: (provider: ImageProvider) => void;

    // 對話視覺模式設定
    dialogueVisualMode: DialogueVisualMode;
    setDialogueVisualMode: (mode: DialogueVisualMode) => void;
    veoModel: VeoModel;
    setVeoModel: (model: VeoModel) => void;
    veoResolution: VideoResolution;
    setVeoResolution: (res: VideoResolution) => void;
    veoDuration: VideoDuration;
    setVeoDuration: (dur: VideoDuration) => void;
}


export const ConfigPage: React.FC<ConfigPageProps> = ({
    geminiApiKey, setGeminiApiKey, saveGeminiKey, setSaveGeminiKey,
    elevenLabsApiKey, setElevenLabsApiKey, saveElevenLabsKey, setSaveElevenLabsKey,
    elevenLabsVoices, isLoadingVoices, onFetchVoices,
    llmProvider, setLlmProvider, ttsProvider, setTtsProvider,
    geminiModel, setGeminiModel,
    enableSfx, setEnableSfx, includeNarrator, setIncludeNarrator,
    useElevenLabsForSpeech, setUseElevenLabsForSpeech,
    youtubeClientId, setYoutubeClientId, saveYoutubeClientId, setSaveYoutubeClientId,
    isYouTubeLoggedIn, isLoadingYouTube, onYouTubeLogin, onYouTubeLogout,
    youtubeChannels, selectedChannelId, setSelectedChannelId,
    youtubePlaylists, selectedPlaylistId, setSelectedPlaylistId,
    // 影像設定
    imageAspectRatio, setImageAspectRatio,
    imageStylePreset, setImageStylePreset,
    customImageStyle, setCustomImageStyle,
    enableDialogueImages, setEnableDialogueImages,
    imageModel, setImageModel,
    imageProvider, setImageProvider,
    // 對話視覺模式
    dialogueVisualMode, setDialogueVisualMode,
    veoModel, setVeoModel,
    veoResolution, setVeoResolution,
    veoDuration, setVeoDuration,
}) => {


    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h2 className="text-2xl font-bold text-white">Settings</h2>
                <p className="text-zinc-500 text-sm">API Keys & Preferences</p>
            </div>

            <div className="space-y-4">
                {/* ElevenLabs API Key */}
                <div className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/20 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-md">
                            <Key size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-blue-300">ElevenLabs API Key</p>
                            <p className="text-xs text-zinc-500">Required for speech & sound effect generation</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="Enter ElevenLabs API Key..."
                            value={elevenLabsApiKey}
                            onChange={(e) => setElevenLabsApiKey(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                        {elevenLabsApiKey && (
                            <button
                                onClick={() => setSaveElevenLabsKey(!saveElevenLabsKey)}
                                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${saveElevenLabsKey ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <Save size={12} />
                            </button>
                        )}
                        <button
                            onClick={onFetchVoices}
                            disabled={!elevenLabsApiKey || isLoadingVoices}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                        >
                            {isLoadingVoices ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Load Voices
                        </button>
                    </div>
                    {elevenLabsVoices.length > 0 && (
                        <p className="text-xs text-blue-400">✓ Loaded {elevenLabsVoices.length} voices</p>
                    )}
                </div>

                {/* LLM Provider Selection */}
                <div className="p-4 bg-purple-500/5 rounded-lg border border-purple-500/20 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 text-purple-400 rounded-md">
                            <Wand2 size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-purple-300">Script Generation (LLM)</p>
                            <p className="text-xs text-zinc-500">Select AI to generate script</p>
                        </div>
                    </div>
                    <div className="flex gap-1 bg-zinc-950 rounded p-1">
                        <button
                            onClick={() => setLlmProvider('gemini')}
                            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors bg-emerald-600 text-white`}
                        >
                            Gemini
                        </button>
                    </div>
                    {/* Model Selection */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-400 font-medium min-w-[50px]">Model:</label>
                        <select
                            value={geminiModel}
                            onChange={(e) => setGeminiModel(e.target.value as GeminiModel)}
                            className="flex-1 bg-zinc-950 border border-emerald-500/30 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                        >
                            {GEMINI_MODELS.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* TTS Provider Selection */}
                <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-md">
                            <Volume2 size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-amber-300">Speech Generation (TTS)</p>
                            <p className="text-xs text-zinc-500">Select AI voice synthesis ({ttsRegistry.listAll().length} available)</p>
                        </div>
                    </div>
                    <div className="flex gap-1 bg-zinc-950 rounded p-1">
                        {ttsRegistry.listAll().map(provider => {
                            // Build config to check if provider is configured
                            const config = {
                                geminiApiKey,
                                elevenLabsApiKey,
                            };
                            const isConfigured = provider.isConfigured(config);
                            const isActive = ttsProvider === provider.id;

                            // Dynamic color based on provider id
                            const activeColors: Record<string, string> = {
                                'gemini': 'bg-emerald-600',
                                'elevenlabs': 'bg-blue-600',
                            };
                            const activeColor = activeColors[provider.id] || 'bg-purple-600';

                            return (
                                <button
                                    key={provider.id}
                                    onClick={() => setTtsProvider(provider.id as TtsProvider)}
                                    disabled={!isConfigured}
                                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${isActive
                                        ? `${activeColor} text-white`
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                                    title={!isConfigured ? `Please set ${provider.name} API Key first` : provider.description}
                                >
                                    {provider.name}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-zinc-500">
                        💡 To add a new voice API, simply add a file in lib/tts/providers/ to automatically register it
                    </p>
                </div>

                {/* Gemini API Key */}
                <div className="p-4 bg-black/20 rounded-lg border border-zinc-800/50 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-md">
                            <Key size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Gemini API Key</p>
                            <p className="text-xs text-zinc-500">Script generation & TTS fallback</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="Enter Gemini API Key..."
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                        />
                        {geminiApiKey && (
                            <button
                                onClick={() => setSaveGeminiKey(!saveGeminiKey)}
                                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${saveGeminiKey ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <Save size={12} />
                            </button>
                        )}
                    </div>
                </div>



                {/* Feature Toggles */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Narrator Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-black/20 border-zinc-800/50">
                        <div className="flex items-center gap-2">
                            <Mic2 size={16} className="text-purple-400" />
                            <span className="text-sm">Narrator</span>
                        </div>
                        <button onClick={() => setIncludeNarrator(!includeNarrator)}>
                            {includeNarrator ? <ToggleRight size={24} className="text-blue-400" /> : <ToggleLeft size={24} className="text-zinc-600" />}
                        </button>
                    </div>

                    {/* SFX Toggle */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${elevenLabsApiKey ? 'bg-black/20 border-zinc-800/50' : 'bg-zinc-900/30 border-zinc-800/30 opacity-50'}`}>
                        <div className="flex items-center gap-2">
                            <Speaker size={16} className="text-amber-400" />
                            <span className="text-sm">Sound Effects</span>
                        </div>
                        <button onClick={() => setEnableSfx(!enableSfx)} disabled={!elevenLabsApiKey}>
                            {enableSfx && elevenLabsApiKey ? <ToggleRight size={24} className="text-blue-400" /> : <ToggleLeft size={24} className="text-zinc-600" />}
                        </button>
                    </div>
                </div>

                {/* 影像生成設定 */}
                <div className="p-4 bg-pink-500/5 rounded-lg border border-pink-500/20 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500/10 text-pink-400 rounded-md">
                            <Image size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-pink-300">Image Generation</p>
                            <p className="text-xs text-zinc-500">Character, scene, and dialogue image settings</p>
                        </div>
                    </div>

                    {/* 服務提供者 */}
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                            <Sparkles size={14} />
                            Image Service
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => {
                                    setImageProvider('gemini');
                                }}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors border bg-pink-600 border-pink-500 text-white`}
                            >
                                Gemini
                            </button>
                        </div>
                    </div>

                    {/* 模型選擇 */}
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                            <Cpu size={14} />
                            Generation Model
                        </label>
                        <select
                            value={imageModel}
                            onChange={(e) => setImageModel(e.target.value as ImageModel)}
                            className="w-full bg-zinc-950 border border-pink-500/30 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                        >
                            {GEMINI_IMAGE_MODELS.map(model => (
                                <option key={model} value={model}>
                                    {model}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Aspect Ratio 選擇 */}
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                            <Palette size={14} />
                            Output Size
                        </label>
                        <select
                            value={imageAspectRatio}
                            onChange={(e) => setImageAspectRatio(e.target.value as ImageAspectRatio)}
                            className="w-full bg-zinc-950 border border-pink-500/30 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                        >
                            {IMAGE_ASPECT_RATIOS.map(ratio => (
                                <option key={ratio.value} value={ratio.value}>
                                    {ratio.label} - {ratio.useCase}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 風格預設選擇 */}
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-medium">Style Presets</label>
                        <div className="grid grid-cols-3 gap-2">
                            {IMAGE_STYLE_PRESETS.map(preset => (
                                <button
                                    key={preset.value}
                                    onClick={() => setImageStylePreset(preset.value)}
                                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${imageStylePreset === preset.value
                                        ? 'bg-pink-600 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 自訂風格文字 (當選擇 custom 時顯示) */}
                    {imageStylePreset === 'custom' && (
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-400 font-medium">Custom Style Description</label>
                            <textarea
                                value={customImageStyle}
                                onChange={(e) => setCustomImageStyle(e.target.value)}
                                placeholder="e.g., pixel art style, 8-bit retro game aesthetic..."
                                className="w-full bg-zinc-950 border border-pink-500/30 rounded px-3 py-2 text-sm focus:outline-none focus:border-pink-500 h-20 resize-none"
                            />
                        </div>
                    )}

                    {/* 對話影像開關 */}
                    <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-zinc-800/50">
                        <div className="flex items-center gap-2">
                            <Image size={16} className="text-pink-400" />
                            <div>
                                <span className="text-sm">Dialogue Images</span>
                                <p className="text-xs text-zinc-500">Generate separate images for each dialogue</p>
                            </div>
                        </div>
                        <button onClick={() => setEnableDialogueImages(!enableDialogueImages)}>
                            {enableDialogueImages
                                ? <ToggleRight size={24} className="text-pink-400" />
                                : <ToggleLeft size={24} className="text-zinc-600" />
                            }
                        </button>
                    </div>

                    {/* 對話視覺模式選擇 */}
                    {enableDialogueImages && (
                        <div className="space-y-3 p-3 bg-black/20 rounded-lg border border-zinc-800/50">
                            <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                <Wand2 size={14} />
                                Dialogue Image Generation Mode
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setDialogueVisualMode('compose')}
                                    className={`relative flex flex-col items-center gap-1 py-3 rounded-lg text-sm font-medium transition-colors border ${dialogueVisualMode === 'compose'
                                        ? 'bg-pink-600 border-pink-500 text-white'
                                        : 'bg-black/20 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                >
                                    🎨 Image Composition
                                    <span className="text-[10px] opacity-70">Character + Scene</span>
                                </button>
                                <button
                                    onClick={() => { }}
                                    disabled
                                    className="relative flex flex-col items-center gap-1 py-3 rounded-lg text-sm font-medium bg-black/20 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                                >
                                    🎬 AI Video (Veo)
                                    <span className="text-[10px] opacity-70">Native dialogue video</span>
                                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-amber-500 text-black text-[9px] font-bold rounded">
                                        Coming Soon
                                    </span>
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                💡 Image Composition: Use character and scene images as reference to generate dialogue images
                            </p>
                        </div>
                    )}
                </div>

                {/* YouTube Configuration */}

                <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 text-red-400 rounded-md">
                            <Youtube size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-red-300">YouTube Upload</p>
                            <p className="text-xs text-zinc-500">OAuth 2.0 Settings</p>
                        </div>
                    </div>

                    {/* Client ID */}
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="YouTube OAuth Client ID..."
                            value={youtubeClientId}
                            onChange={(e) => setYoutubeClientId(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                        />
                        {youtubeClientId && (
                            <button
                                onClick={() => setSaveYoutubeClientId(!saveYoutubeClientId)}
                                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${saveYoutubeClientId ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <Save size={12} />
                            </button>
                        )}
                    </div>

                    {/* Login/Logout Button */}
                    {isYouTubeLoggedIn ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-green-400">✓ Logged In</span>
                                <button
                                    onClick={onYouTubeLogout}
                                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm flex items-center gap-1"
                                >
                                    <LogOut size={14} /> Log Out
                                </button>
                            </div>

                            {/* Channel Selection */}
                            {youtubeChannels.length > 0 && (
                                <select
                                    value={selectedChannelId}
                                    onChange={(e) => setSelectedChannelId(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
                                >
                                    {youtubeChannels.map(ch => (
                                        <option key={ch.id} value={ch.id}>{ch.title}</option>
                                    ))}
                                </select>
                            )}

                            {/* Playlist Selection */}
                            {youtubePlaylists.length > 0 && (
                                <select
                                    value={selectedPlaylistId}
                                    onChange={(e) => setSelectedPlaylistId(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
                                >
                                    <option value="">-- Select Playlist (Optional) --</option>
                                    {youtubePlaylists.map(pl => (
                                        <option key={pl.id} value={pl.id}>{pl.title}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={onYouTubeLogin}
                            disabled={!youtubeClientId || isLoadingYouTube}
                            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoadingYouTube ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                            Log In to YouTube
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
