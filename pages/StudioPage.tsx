/**
 * StudioPage Component  
 * Core editing page for script, cast, and audio generation
 * Can work standalone or with a batch job
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    Wand2, Play, Square, Sparkles, AlertCircle, FileText, Users,
    Volume2, Loader2, Speaker, Key, Download, Save, FolderOpen,
    Mic, Mic2, RefreshCw, ArrowLeft, Image, Upload, Palette, X, FilePlus
} from 'lucide-react';
import {
    ItemType, ScriptItem, CastMember, SceneDefinition, GeneratedPodcastInfo, ElevenLabsVoice,
    LlmProvider, TtsProvider, GeminiModel,
    ImageAspectRatio, ImageStylePreset, ImageModel, ImageProvider, IMAGE_STYLE_PRESETS,
    DialogueVisualMode, CharacterRef
} from '../types';
import { BatchJob, AppPage } from '../batchTypes';
import { generateScriptFromStory, generateSpeech, generateCharacterImage, generateSceneImage, generateDialogueImageForItem, generateImage, generateImageDescription, generateCompositeDialogueImage, CharacterRef as GeminiCharacterRef } from '../services/geminiService';
import { getCharacterImagePrompt, getSceneImagePrompt, getDialogueImagePrompt } from '../services/promptTemplates';
import { generateElevenLabsSfx, generateElevenLabsSpeech } from '../services/elevenLabsService';
import { decodeRawPCM, decodeAudioFile, getAudioContext, mergeAudioBuffers, bufferToWav, blobToBase64, bufferToMp3, createWebmVideo } from '../utils/audioUtils';
import { ScriptItemCard } from '../components/ScriptItemCard';
import { Player } from '../components/Player';
import { PodcastPublishSection, PodcastPublishSectionRef } from '../components/PodcastPublishSection';
import { getBatchJob, updateBatchJob, addBatchJob, saveAudioBlob, generateAudioKey, saveItemAudioBase64, generateItemAudioKey } from '../services/batchStorageService';
import {
    getYouTubeAccessToken,
    YouTubePlaylist,
    YouTubeUploadProgress,
    YouTubeUploadResult
} from '../services/youtubeService';
import { downloadBlob, generatePodcastCoverArt } from '../services/podcastService';

const GEMINI_VOICES = [
    "Zephyr", "Puck", "Charon", "Kore", "Fenrir",
    "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
    "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina",
    "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
    "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird",
    "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"
].sort();

// Import the new hook
import { useDramaData } from '../hooks/useDramaData';

// Import TTS registry for provider-agnostic speech generation
import { ttsRegistry, TtsConfig } from '../lib/tts';

const isNarrator = (name: string) => {
    const n = name.trim().toLowerCase();
    return n === 'narrator' || n === '旁白' || n.includes('narrator') || n.includes('旁白');
};

interface StudioPageProps {
    jobId?: string | null;
    onNavigate: (page: AppPage) => void;
    onSaveJob?: (job: BatchJob) => void;
    // Config props
    geminiApiKey: string;
    elevenLabsApiKey: string;
    elevenLabsVoices: ElevenLabsVoice[];
    llmProvider: LlmProvider;
    ttsProvider: TtsProvider;
    geminiModel: GeminiModel;
    enableSfx: boolean;
    includeNarrator: boolean;
    useElevenLabsForSpeech: boolean;
    isYouTubeLoggedIn: boolean;
    selectedPlaylistId: string;
    youtubePlaylists: YouTubePlaylist[];
    // 影像設定
    imageAspectRatio: ImageAspectRatio;
    imageStylePreset: ImageStylePreset;
    customImageStyle: string;
    enableDialogueImages: boolean;
    imageModel: ImageModel;
    imageProvider: ImageProvider;
    // 對話視覺模式
    dialogueVisualMode: DialogueVisualMode;
}

export const StudioPage: React.FC<StudioPageProps> = ({
    jobId,
    onNavigate,
    onSaveJob,
    geminiApiKey,
    elevenLabsApiKey,
    elevenLabsVoices,
    llmProvider,
    ttsProvider,
    geminiModel,
    enableSfx,
    includeNarrator,
    useElevenLabsForSpeech,
    isYouTubeLoggedIn,
    selectedPlaylistId,
    youtubePlaylists,
    // 影像設定
    imageAspectRatio,
    imageStylePreset,
    customImageStyle,
    enableDialogueImages,
    imageModel,
    imageProvider,
    // 對話視覺模式
    dialogueVisualMode,
}) => {

    // Core state
    // Core state - replaced with useDramaData
    const {
        storyText, setStoryText,
        cast, setCast,
        scenes, setScenes,
        items, setItems,
        podcastInfo, setPodcastInfo,
        coverArtBase64, setCoverArtBase64,
        loadFromJob,
        restoreDraft
    } = useDramaData();

    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 影像生成狀態
    const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null); // 'cast:name' or 'scene:id' or 'item:id'
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [previewingVoiceFor, setPreviewingVoiceFor] = useState<string | null>(null);

    // Podcast generated files state
    const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
    const [webmBlob, setWebmBlob] = useState<Blob | null>(null);
    const [rssZipBlob, setRssZipBlob] = useState<Blob | null>(null);
    // coverArtBase64 managed by useDramaData

    // YouTube upload state
    const [youtubeUploadProgress, setYoutubeUploadProgress] = useState<YouTubeUploadProgress | null>(null);
    const [youtubeUploadResult, setYoutubeUploadResult] = useState<YouTubeUploadResult | null>(null);
    const [youtubeUploadError, setYoutubeUploadError] = useState<string | null>(null);
    const [isUploadingToYouTube, setIsUploadingToYouTube] = useState(false);

    const podcastPublishRef = useRef<PodcastPublishSectionRef>(null);

    // Load batch job if editing
    useEffect(() => {
        const fetchJob = async () => {
            if (!jobId) return;
            const job = getBatchJob(jobId);
            if (job) {
                await loadFromJob(job);
            }
        };
        fetchJob();
    }, [jobId, loadFromJob]);

    // 草稿暫存功能
    // 1. 載入草稿
    useEffect(() => {
        if (jobId) return; // 如果是瀏覽特定 Batch Job，不載入草稿
        restoreDraft();
    }, [jobId, restoreDraft]);

    // 2. 自動儲存草稿
    useEffect(() => {
        if (jobId) return; // 如果是 Batch Job，不覆寫草稿

        const saveHandler = setTimeout(async () => {
            try {
                // Convert AudioBuffers to Blobs for storage
                // Note: IndexedDB handles Blobs efficiently
                const { bufferToWav } = await import('../utils/audioUtils');

                const itemsToSave = items.map(item => {
                    if (item.audioBuffer) {
                        // Create a fresh object
                        const { audioBuffer, ...rest } = item;
                        // Convert to WAV Blob for persistence
                        const blob = bufferToWav(audioBuffer);
                        return {
                            ...rest,
                            draftAudioBlob: blob
                        };
                    }
                    return item;
                });

                const draftData = {
                    storyText,
                    cast,
                    scenes,
                    items: itemsToSave,
                    podcastInfo,
                    coverArtBase64,
                    lastUpdated: Date.now()
                };

                const { saveDraft } = await import('../services/batchStorageService');
                await saveDraft(draftData);
                console.log('[Draft] Auto-saved to IndexedDB');
            } catch (e) {
                console.warn('[Draft] Failed to save draft:', e);
            }
        }, 1000); // Debounce 1s

        return () => clearTimeout(saveHandler);
    }, [storyText, cast, scenes, items, podcastInfo, coverArtBase64, jobId]);

    // Handle upload state change callback
    const handleUploadStateChange = (state: { isUploading: boolean; progress: YouTubeUploadProgress | null; result: YouTubeUploadResult | null; error: string | null }) => {
        setIsUploadingToYouTube(state.isUploading);
        setYoutubeUploadProgress(state.progress);
        setYoutubeUploadResult(state.result);
        setYoutubeUploadError(state.error);
    };

    const handleGenerateScript = async () => {
        if (!storyText.trim()) return;

        if (!geminiApiKey) {
            setError('Please enter Gemini API key first.');
            return;
        }

        setError(null);
        setIsGeneratingScript(true);
        setCast([]);
        setScenes([]);
        setItems([]);
        setPodcastInfo(null);

        try {
            const shouldIncludeSfx = enableSfx && !!elevenLabsApiKey;
            const result = await generateScriptFromStory(
                storyText, shouldIncludeSfx, includeNarrator,
                elevenLabsVoices, geminiApiKey, geminiModel, enableDialogueImages
            );

            // Set voiceType based on ttsProvider
            const finalCast = result.cast.map(member => {
                if (ttsProvider === 'elevenlabs' && member.elevenLabsVoiceId && elevenLabsVoices.length > 0) {
                    const elVoice = elevenLabsVoices.find(v => v.voice_id === member.elevenLabsVoiceId);
                    if (elVoice) {
                        return { ...member, voiceType: 'elevenlabs' as const, voice: elVoice.name };
                    }
                }
                return { ...member, voiceType: 'gemini' as const };
            });

            setCast(finalCast);
            setScenes(result.scenes || []);
            setItems(result.items);
            setPodcastInfo(result.podcastInfo);

            // Save to batch job if editing
            if (jobId) {
                updateBatchJob(jobId, {
                    status: 'script_ready',
                    scriptData: {
                        cast: finalCast,
                        scenes: result.scenes,
                        items: result.items,
                        podcastInfo: result.podcastInfo,
                    }
                });
            }

        } catch (e: any) {
            setError(e.message || "Failed to generate script.");
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleUpdateItem = (id: string, updates: Partial<ScriptItem>) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleMoveItem = (index: number, direction: 'up' | 'down') => {
        const newItems = [...items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newItems.length) {
            [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
            setItems(newItems);
        }
    };

    const handleUpdateCast = (characterName: string, updates: Partial<CastMember>) => {
        setCast(prev => prev.map(c => c.name === characterName ? { ...c, ...updates } : c));
    };

    const handleUpdateScene = (sceneId: string, updates: Partial<SceneDefinition>) => {
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
    };

    // 生成角色圖片
    const handleGenerateCharacterImage = async (characterName: string) => {
        if (!geminiApiKey) {
            setError('Please set Gemini API Key first');
            return;
        }
        const character = cast.find(c => c.name === characterName);
        if (!character) return;

        setGeneratingImageFor(`cast:${characterName}`);
        try {
            const imageBase64 = await generateCharacterImage(
                character,
                imageStylePreset,
                customImageStyle,
                imageAspectRatio,
                imageModel,
                geminiApiKey
            );

            handleUpdateCast(characterName, {
                imageBase64: imageBase64,
                imagePrompt: character.imagePrompt || (character.description ? `Character portrait of ${character.description}` : undefined),
                isCustomImage: false
            });
        } catch (error: any) {
            console.error('Failed to generate character image:', error);
            setError(`Generation failed: ${error.message}`);
        } finally {
            setGeneratingImageFor(null);
        }
    };

    // 生成場景圖片
    const handleGenerateSceneImage = async (sceneId: string) => {
        if (!geminiApiKey) {
            setError('Please set Gemini API Key first');
            return;
        }

        const scene = scenes.find(s => s.id === sceneId);
        if (!scene) return;

        setGeneratingImageFor(`scene:${sceneId}`);
        try {
            const imageBase64 = await generateSceneImage(
                scene,
                imageStylePreset,
                customImageStyle,
                imageAspectRatio,
                imageModel,
                geminiApiKey
            );

            handleUpdateScene(sceneId, {
                imageBase64: imageBase64,
                isCustomImage: false
            });
        } catch (error: any) {
            console.error('Failed to generate scene image:', error);
            setError(`Generation failed: ${error.message}`);
        } finally {
            setGeneratingImageFor(null);
        }
    };

    // 圖片上傳處理
    const handleImageUpload = async (
        type: 'cast' | 'scene' | 'item',
        id: string,
        file: File
    ) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = (e.target?.result as string)?.split(',')[1];
            if (!base64) return;

            // Generate description from image (Reverse Engineering Prompt)
            let newImagePrompt = '';
            // Only auto-generate if API key is available
            const apiKey = imageProvider === 'gemini' ? geminiApiKey : '';

            if (apiKey) {
                console.log('Generating description for uploaded image...');
                generateImageDescription(base64, apiKey).then(desc => {
                    if (desc) {
                        console.log('Generated description:', desc);
                        if (type === 'cast') {
                            handleUpdateCast(id, { imagePrompt: desc });
                        } else if (type === 'scene') {
                            handleUpdateScene(id, { imagePrompt: desc });
                        } else if (type === 'item') {
                            handleUpdateItem(id, { imagePrompt: desc });
                        }
                    }
                });
            }

            if (type === 'cast') {
                handleUpdateCast(id, { imageBase64: base64, isCustomImage: true });
            } else if (type === 'scene') {
                handleUpdateScene(id, { imageBase64: base64, isCustomImage: true });
            } else if (type === 'item') {
                handleUpdateItem(id, { imageBase64: base64, isCustomImage: true });
            }
        };
        reader.readAsDataURL(file);
    };

    const handlePreviewVoice = async (member: CastMember) => {
        if (!member.voice) return;
        setPreviewingVoiceFor(member.name);
        try {
            const ttsConfig: TtsConfig = {
                geminiApiKey,
                elevenLabsApiKey,
            };

            // Determine provider logic
            let providerId = member.voiceType || ttsProvider;
            if (useElevenLabsForSpeech && elevenLabsApiKey && !member.voiceType) {
                providerId = 'elevenlabs';
            }

            // Resolve voiceId (for ElevenLabs) vs voiceName (others)
            const voiceId = providerId === 'elevenlabs' && member.elevenLabsVoiceId
                ? member.elevenLabsVoiceId
                : member.voice;

            const text = member.voicePrompt?.trim() || "Hello, this is a voice preview.";

            const result = await ttsRegistry.generateSpeech(
                providerId,
                {
                    text,
                    voiceId,
                    voiceName: member.voice,
                    voicePrompt: member.voicePrompt,
                    expression: 'neutral',
                },
                ttsConfig
            );

            const ctx = getAudioContext();
            const buffer = result.format === 'pcm'
                ? await decodeRawPCM(result.audioBase64, ctx)
                : await decodeAudioFile(result.audioBase64, ctx);

            handlePreviewAudio(buffer);
        } catch (e: any) {
            console.error('Preview failed:', e);
            alert(`Preview failed: ${e.message}`);
        } finally {
            setPreviewingVoiceFor(null);
        }
    };

    const handleGenerateAudio = async (id: string, text: string, voice: string, expression: string): Promise<AudioBuffer | null> => {
        handleUpdateItem(id, { isLoadingAudio: true, generationError: undefined });
        try {
            const ctx = getAudioContext();
            let buffer: AudioBuffer;

            const item = items.find(i => i.id === id);
            const castMember = item?.character ? cast.find(c => c.name === item.character) : undefined;

            // Build config for TTS registry
            const ttsConfig: TtsConfig = {
                geminiApiKey,
                elevenLabsApiKey,
            };

            // Determine which provider to use:
            // 1. Character-specific voiceType takes priority
            // 2. Fall back to global ttsProvider setting
            // 3. If ElevenLabs toggle is on, use that
            // 4. Default to gemini
            let providerId = castMember?.voiceType || ttsProvider;

            // Handle legacy useElevenLabsForSpeech toggle
            if (useElevenLabsForSpeech && elevenLabsApiKey && !castMember?.voiceType) {
                providerId = 'elevenlabs';
            }

            // For ElevenLabs, we need to use the voice_id, not the name
            const voiceId = providerId === 'elevenlabs' && castMember?.elevenLabsVoiceId
                ? castMember.elevenLabsVoiceId
                : voice;

            // Use registry for speech generation
            const result = await ttsRegistry.generateSpeech(
                providerId,
                {
                    text,
                    voiceId,
                    voiceName: voice,
                    voicePrompt: castMember?.voicePrompt,
                    expression,
                },
                ttsConfig
            );

            // Decode based on format
            buffer = result.format === 'pcm'
                ? await decodeRawPCM(result.audioBase64, ctx)
                : await decodeAudioFile(result.audioBase64, ctx);

            handleUpdateItem(id, { audioBuffer: buffer, isLoadingAudio: false, generationError: undefined });
            return buffer;
        } catch (e: any) {
            console.error(e);
            handleUpdateItem(id, { isLoadingAudio: false, generationError: e.message || "Unknown error occurred" });
            return null;
        }
    };

    const handleGenerateSfx = async (id: string, description: string): Promise<AudioBuffer | null> => {
        if (!elevenLabsApiKey) {
            alert("Please enter ElevenLabs API Key first");
            return null;
        }
        handleUpdateItem(id, { isLoadingAudio: true, generationError: undefined });
        try {
            const base64 = await generateElevenLabsSfx(description, 4, elevenLabsApiKey);
            const ctx = getAudioContext();
            const buffer = await decodeAudioFile(base64, ctx);
            handleUpdateItem(id, { audioBuffer: buffer, isLoadingAudio: false, generationError: undefined });
            return buffer;
        } catch (e: any) {
            console.error(e);
            handleUpdateItem(id, { isLoadingAudio: false, generationError: e.message || "Failed to generate SFX" });
            return null;
        }
    };

    // Dialogue Image Generation
    const handleGenerateItemImage = async (itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        if (!geminiApiKey) {
            alert('Please set Gemini API Key first');
            return;
        }

        setGeneratingImageFor(`item:${itemId}`);

        try {
            // Find context
            const scene = scenes.find(s => s.name === item.location) || null;
            const suffix = IMAGE_STYLE_PRESETS.find(p => p.value === imageStylePreset)?.promptSuffix || customImageStyle;

            let imageBase64;

            // Check if compose mode and using Gemini
            // Check if compose mode and using Gemini
            if (dialogueVisualMode === 'compose' && imageProvider === 'gemini') {
                // Collect character references
                // Strategy: Use item.sceneCharacters if available, otherwise fallback to item.character + scene.characterNames
                const characterRefs: GeminiCharacterRef[] = [];
                const addedNames = new Set<string>();

                const isNarrator = item.character === 'Narrator' || item.character === '旁白';

                // 1. If NOT Narrator, add the current speaking character first
                if (!isNarrator && item.character) {
                    const speakingMember = cast.find(c => c.name === item.character);
                    if (speakingMember?.imageBase64) {
                        characterRefs.push({
                            name: speakingMember.name,
                            imageBase64: speakingMember.imageBase64
                        });
                        addedNames.add(speakingMember.name);
                    }
                }

                // 2. Add characters from item.sceneCharacters (if available) or scene.characterNames (fallback)
                const sourceNames = item.sceneCharacters && item.sceneCharacters.length > 0
                    ? item.sceneCharacters
                    : scene?.characterNames || [];

                for (const name of sourceNames) {
                    if (addedNames.has(name)) continue; // Skip if already added
                    if (name === 'Narrator' || name === '旁白') continue; // Skip narrator in visual refs

                    const member = cast.find(c => c.name === name);
                    if (member?.imageBase64) {
                        characterRefs.push({
                            name: member.name,
                            imageBase64: member.imageBase64
                        });
                        addedNames.add(member.name);
                    }
                }

                // ============================================
                // ANONYMIZATION LOGIC
                // ============================================
                // Replace real names with "Character A", "Scene A" etc. to prevent:
                // 1. Text rendering in image
                // 2. Bias from internal knowledge overriding reference images

                const nameMapping = new Map<string, string>();

                // 1. Map Characters -> Character A, Character B... 
                // CRITICAL: Use the order from `item.sceneCharacters` if available, 
                // because the Script AI is instructed to use "Character A" for the 1st person in that list.
                // Fallback to global order if sceneCharacters is missing.
                const characterOrderSource = (item.sceneCharacters && item.sceneCharacters.length > 0)
                    ? item.sceneCharacters
                    : cast.map(c => c.name); // Fallback: all cast

                characterOrderSource.forEach((charName, index) => {
                    const alias = `Character ${String.fromCharCode(65 + index)}`; // A, B, C...
                    nameMapping.set(charName, alias);
                });

                // 2. Map Scenes -> Scene A, Scene B... (Keep global order or simple replacement)
                // For "The Scene", simply map the current location name to "The Scene" or "Scene A"
                if (scene?.name) {
                    nameMapping.set(scene.name, "The Scene"); // Match schema instruction
                }
                scenes.forEach((s, index) => {
                    if (s.name !== scene?.name) { // Map others just in case
                        const alias = `Scene ${String.fromCharCode(65 + index)}`;
                        nameMapping.set(s.name, alias);
                    }
                });

                // 3. Prepare Anonymized Action Prompt
                // Use item.imagePrompt if available (it's auto-generated visual description)
                let actionPrompt = item.imagePrompt;

                if (!actionPrompt) {
                    // Fallback logic if no imagePrompt
                    const charDesc = !isNarrator && item.character ? `The character (${item.character})` : 'The scene';
                    const expressionDesc = item.expression ? `, with ${item.expression} expression` : '';
                    actionPrompt = `${charDesc} is shown${expressionDesc}. Show the scene vivid and detailed.`;
                }

                // Replace names in prompt
                // Sort keys by length descending to avoid partial matches
                let anonymizedPrompt = actionPrompt;
                Array.from(nameMapping.keys())
                    .sort((a, b) => b.length - a.length)
                    .forEach(realName => {
                        const alias = nameMapping.get(realName)!;
                        // Replace all occurrences, case-insensitive logic ideally, but simple replaceAll for now
                        // Add boundaries to avoid replacing substrings in other words if possible, but names are usually distinct
                        anonymizedPrompt = anonymizedPrompt.replaceAll(realName, alias);
                    });

                anonymizedPrompt += " DO NOT render any text or dialogue in the image.";

                // 4. Prepare Anonymized Character Refs
                const anonymizedRefs = characterRefs.map(ref => ({
                    name: nameMapping.get(ref.name) || ref.name, // Use alias (Character A)
                    imageBase64: ref.imageBase64
                }));

                console.log('[Studio] Anonymization:',
                    '\nOriginal Prompt:', actionPrompt,
                    '\nAnonymized:', anonymizedPrompt
                );

                console.log('[Studio] Using Compose Mode with', anonymizedRefs.length, 'character refs:', anonymizedRefs.map(r => r.name).join(', '));

                imageBase64 = await generateCompositeDialogueImage(
                    anonymizedPrompt,
                    anonymizedRefs,
                    scene?.imageBase64 || null,
                    imageStylePreset,
                    customImageStyle,
                    imageAspectRatio,
                    imageModel,
                    geminiApiKey
                );
            } else {
                // Gemini fallback (non-compose mode)
                const prompt = getDialogueImagePrompt(item, scene, cast, suffix);
                console.log('[Studio] Generating Item Image Prompt:', prompt);
                imageBase64 = await generateImage(prompt, imageAspectRatio, imageModel, geminiApiKey);
            }

            handleUpdateItem(itemId, { imageBase64, isCustomImage: false });
        } catch (e: any) {
            console.error('Item Image Gen Error:', e);
            handleUpdateItem(itemId, { generationError: e.message || 'Image Generation Failed' });
        } finally {
            setGeneratingImageFor(null);
        }
    };
    // Fill missing audio - only generate for items without audio
    const handleFillMissingAudio = async (): Promise<AudioBuffer[]> => {
        const itemsWithoutAudio = items.filter(i => !i.audioBuffer);
        if (itemsWithoutAudio.length === 0) {
            alert('All items already have audio!');
            return items.map(i => i.audioBuffer).filter((b): b is AudioBuffer => !!b);
        }

        setIsGeneratingAll(true);
        const resultBuffers: (AudioBuffer | null)[] = [];

        for (const item of itemsWithoutAudio) {
            if (item.type === ItemType.SPEECH && item.text) {
                const char = cast.find(c => c.name === item.character);
                const buffer = await handleGenerateAudio(item.id, item.text, char?.voice || 'Puck', item.expression || '');
                resultBuffers.push(buffer);
                await new Promise(r => setTimeout(r, 300));
            } else if (item.type === ItemType.SFX && item.sfxDescription && elevenLabsApiKey) {
                const buffer = await handleGenerateSfx(item.id, item.sfxDescription);
                resultBuffers.push(buffer);
                await new Promise(r => setTimeout(r, 300));
            }
        }

        setIsGeneratingAll(false);
        return resultBuffers.filter((b): b is AudioBuffer => !!b);
    };

    // Fill missing images - only generate for items without images
    const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);

    const handleFillMissingImages = async () => {
        const itemsWithoutImage = items.filter(i => !i.imageBase64 && i.type === ItemType.SPEECH);
        if (itemsWithoutImage.length === 0) {
            alert('All dialogue items already have images!');
            return;
        }

        if (!geminiApiKey) {
            alert('Please set Gemini API Key first');
            return;
        }

        setIsGeneratingAllImages(true);

        for (const item of itemsWithoutImage) {
            try {
                await handleGenerateItemImage(item.id);
                await new Promise(r => setTimeout(r, 500)); // Rate limiting
            } catch (e) {
                console.error(`Failed to generate image for item ${item.id}:`, e);
            }
        }

        setIsGeneratingAllImages(false);
    };

    // Fill ALL missing content (audio + images)
    const [isFillingAll, setIsFillingAll] = useState(false);

    const handleFillAllMissing = async () => {
        const missingAudio = items.filter(i => !i.audioBuffer);
        const missingImages = enableDialogueImages ? items.filter(i => !i.imageBase64 && i.type === ItemType.SPEECH) : [];

        if (missingAudio.length === 0 && missingImages.length === 0) {
            alert('All items are already completed!');
            return;
        }

        setIsFillingAll(true);

        // First fill missing audio
        if (missingAudio.length > 0) {
            await handleFillMissingAudio();
        }

        // Then fill missing images (only if enabled)
        if (missingImages.length > 0) {
            await handleFillMissingImages();
        }

        setIsFillingAll(false);
    };

    const handleExportWav = async () => {
        const buffers = items.map(i => i.audioBuffer).filter((b): b is AudioBuffer => !!b);
        if (buffers.length === 0) {
            alert("No audio to export.");
            return;
        }

        const merged = await mergeAudioBuffers(buffers);
        const wavBlob = bufferToWav(merged);
        const url = URL.createObjectURL(wavBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'voice_drama.wav';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Save current work back to batch job
    const handleSaveToJob = async () => {
        if (!jobId) return;

        // Save cover art to IndexedDB if exists
        let coverKey: string | undefined;
        if (coverArtBase64) {
            coverKey = `${jobId}_cover`;
            const { saveItemAudioBase64 } = await import('../services/batchStorageService');
            await saveItemAudioBase64(coverKey, coverArtBase64);
        }

        updateBatchJob(jobId, {
            scriptData: {
                cast,
                scenes: [],
                items: items.map(i => ({ ...i, audioBuffer: undefined })), // Don't save audio buffers directly
                podcastInfo,
            },
            files: {
                coverKey,
            }
        });
        alert('Saved!');
    };

    // Save current work as a NEW batch job (when not editing existing job)
    const handleSaveAsNewJob = async () => {
        if (!storyText.trim() || items.length === 0) {
            alert('Please input story and generate script first');
            return;
        }

        // Generate new job ID
        const newJobId = `job_${Date.now()}`;
        const now = Date.now();

        // Save audio buffers to IndexedDB
        const itemsToSave = await Promise.all(items.map(async (item) => {
            if (item.audioBuffer) {
                // Convert AudioBuffer to WAV base64 for storage
                const { bufferToWav, blobToBase64 } = await import('../utils/audioUtils');
                const wavBlob = bufferToWav(item.audioBuffer);
                const base64 = await blobToBase64(wavBlob);
                const audioKey = generateItemAudioKey(newJobId, item.id);
                await saveItemAudioBase64(audioKey, base64);

                return {
                    ...item,
                    audioBuffer: undefined,
                    audioKey,
                    audioFormat: 'pcm' as const
                };
            }
            return { ...item, audioBuffer: undefined };
        }));

        // Save cover art if exists
        let coverKey: string | undefined;
        if (coverArtBase64) {
            coverKey = `${newJobId}_cover`;
            await saveItemAudioBase64(coverKey, coverArtBase64);
        }

        // Create new BatchJob
        const newJob = {
            id: newJobId,
            storyText,
            status: 'script_ready' as const,
            createdAt: now,
            updatedAt: now,
            podcastTitle: podcastInfo?.podcastName || 'New Podcast',
            episodeTitle: podcastInfo?.episodeTitle || 'New Episode',
            podcastDescription: podcastInfo?.description || storyText.slice(0, 200),
            coverPrompt: podcastInfo?.coverPrompt,
            scriptData: {
                cast,
                scenes,
                items: itemsToSave,
                podcastInfo,
            },
            files: {
                coverKey,
            }
        };

        addBatchJob(newJob);
        alert('Saved to batch job!');

        // Navigate to batch page
        onNavigate('batch');
    };

    // Play audio buffer preview
    const handlePreviewAudio = (buffer: AudioBuffer) => {
        const ctx = getAudioContext();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const hasAudio = items.some(i => i.audioBuffer);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {jobId && (
                        <button
                            onClick={() => onNavigate('batch')}
                            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-white">Studio</h2>
                        <p className="text-zinc-500 text-sm">
                            {jobId ? 'Edit Batch Job' : 'Create New Podcast'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* New Script button - clears current work */}
                    {!jobId && (storyText.trim() || items.length > 0) && (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to clear the current content and start a new script?')) {
                                    setStoryText('');
                                    setCast([]);
                                    setScenes([]);
                                    setItems([]);
                                    setPodcastInfo(null);
                                    setCoverArtBase64(null);
                                }
                            }}
                            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <FilePlus size={16} /> New Script
                        </button>
                    )}

                    {/* Save to existing batch job */}
                    {jobId && (
                        <button
                            onClick={handleSaveToJob}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <Save size={16} /> Save to Batch
                        </button>
                    )}

                    {/* Save as NEW batch job (when creating from scratch) */}
                    {!jobId && items.length > 0 && (
                        <button
                            onClick={handleSaveAsNewJob}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <FolderOpen size={16} /> Save to Batch List
                        </button>
                    )}
                </div>
            </div>

            {/* Story Input */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={16} /> Story Content
                </h3>
                <textarea
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="Enter story content..."
                    className="w-full h-40 bg-black/40 border border-zinc-700 rounded-lg p-4 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript || !storyText.trim() || !geminiApiKey}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isGeneratingScript ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                    Generate Script & Cast ({geminiModel})
                </button>
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            </section>

            {/* Cast Section */}
            {cast.length > 0 && (
                <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                        <Users size={16} /> Cast ({cast.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {cast.map(member => (
                            <div key={member.name} className={`p-4 rounded-lg border ${isNarrator(member.name) ? 'bg-purple-500/10 border-purple-500/30' : 'bg-black/30 border-zinc-800'}`}>
                                {/* 角色圖片預覽 */}
                                {/* 角色圖片預覽 */}
                                {enableDialogueImages && (
                                    <div className="relative mb-3 aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                                        {member.imageBase64 ? (
                                            <img
                                                src={`data:image/png;base64,${member.imageBase64}`}
                                                alt={member.name}
                                                className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
                                                onClick={() => setZoomedImage(member.imageBase64!)}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                <Users size={48} />
                                            </div>
                                        )}
                                        {/* 生成中 overlay */}
                                        {generatingImageFor === `cast:${member.name}` && (
                                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                                <Loader2 className="animate-spin text-pink-400" size={32} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 角色名稱和圖示 */}
                                <div className="flex items-center gap-2 mb-2">
                                    {isNarrator(member.name) ? <Mic2 size={14} className="text-purple-400" /> : <Mic size={14} className="text-blue-400" />}
                                    <span className="font-medium text-sm">{member.name}</span>
                                </div>

                                {/* 角色 Image Prompt 編輯 */}
                                {enableDialogueImages && (
                                    <div className="mb-2">
                                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 block">Image Prompt (English)</label>
                                        <textarea
                                            value={member.imagePrompt || member.description || ''}
                                            onChange={(e) => handleUpdateCast(member.name, { imagePrompt: e.target.value })}
                                            placeholder="Enter image prompt..."
                                            className="w-full bg-black/20 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 min-h-[60px] resize-none focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                )}

                                {/* Voice 選擇 */}

                                {/* Accent 設定 */}
                                <div className="mb-2">
                                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 block">Voice Accent / Style</label>
                                    <input
                                        type="text"
                                        value={member.voicePrompt || ''}
                                        onChange={(e) => handleUpdateCast(member.name, { voicePrompt: e.target.value })}
                                        placeholder="e.g. British, Cheerful, Deep..."
                                        className="w-full bg-black/20 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>

                                {/* Voice 選擇 */}
                                <div className="flex gap-2 mb-2">
                                    <select
                                        value={member.voice}
                                        onChange={(e) => handleUpdateCast(member.name, { voice: e.target.value })}
                                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs"
                                    >
                                        {member.voiceType === 'elevenlabs'
                                            ? elevenLabsVoices.map(v => <option key={v.voice_id} value={v.name}>{v.name}</option>)
                                            : GEMINI_VOICES.map(v => <option key={v} value={v}>{v}</option>)
                                        }
                                    </select>
                                    <button
                                        onClick={() => handlePreviewVoice(member)}
                                        disabled={previewingVoiceFor === member.name}
                                        className="p-1 px-2 bg-zinc-700 hover:bg-white/10 rounded text-zinc-300 disabled:opacity-50"
                                        title="Preview Voice"
                                    >
                                        {previewingVoiceFor === member.name ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                    </button>
                                </div>

                                {/* 圖片生成/上傳按鈕 */}
                                {enableDialogueImages && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleGenerateCharacterImage(member.name)}
                                            disabled={!geminiApiKey || generatingImageFor !== null}
                                            className="flex-1 px-2 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            <Image size={12} />
                                            Generate Image
                                        </button>
                                        <label className="px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs font-medium flex items-center justify-center gap-1 cursor-pointer">
                                            <Upload size={12} />
                                            Upload
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleImageUpload('cast', member.name, file);
                                                }}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Scene Section */}
            {scenes.length > 0 && (
                <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                        <Palette size={16} /> Scenes ({scenes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {scenes.map(scene => (
                            <div key={scene.id} className="p-4 rounded-lg border bg-black/30 border-zinc-800">
                                {/* 場景圖片預覽 */}
                                {/* 場景圖片預覽 */}
                                {enableDialogueImages && (
                                    <div className="relative mb-3 aspect-video bg-zinc-800 rounded-lg overflow-hidden">
                                        {scene.imageBase64 ? (
                                            <img
                                                src={`data:image/png;base64,${scene.imageBase64}`}
                                                alt={scene.name}
                                                className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
                                                onClick={() => setZoomedImage(scene.imageBase64!)}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                <Palette size={48} />
                                            </div>
                                        )}
                                        {/* 生成中 overlay */}
                                        {generatingImageFor === `scene:${scene.id}` && (
                                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                                <Loader2 className="animate-spin text-pink-400" size={32} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 場景名稱與角色 */}
                                <div className="mb-2">
                                    <h4 className="font-medium text-sm mb-0.5">{scene.name}</h4>
                                    {scene.characterNames && scene.characterNames.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {scene.characterNames.map((charName, idx) => (
                                                <span key={idx} className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700">
                                                    {charName}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 場景視覺描述 / Image Prompt */}
                                {enableDialogueImages && (
                                    <div className="mb-3">
                                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 block">Visual Description (Prompt)</label>
                                        <textarea
                                            value={scene.imagePrompt || scene.visualDescription || ''}
                                            onChange={(e) => handleUpdateScene(scene.id, { imagePrompt: e.target.value })}
                                            placeholder={scene.visualDescription}
                                            className="w-full bg-black/20 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 min-h-[60px] resize-none focus:outline-none focus:border-pink-500/50"
                                        />
                                    </div>
                                )}

                                {/* 圖片生成/上傳按鈕 */}
                                {enableDialogueImages && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleGenerateSceneImage(scene.id)}
                                            disabled={!geminiApiKey || generatingImageFor !== null}
                                            className="flex-1 px-2 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            <Image size={12} />
                                            Generate Scene
                                        </button>
                                        <label className="px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs font-medium flex items-center justify-center gap-1 cursor-pointer">
                                            <Upload size={12} />
                                            Upload
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleImageUpload('scene', scene.id, file);
                                                }}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Script Items */}
            {items.length > 0 && (

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={16} /> Script Items ({items.length})
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleFillAllMissing}
                                disabled={isFillingAll || isGeneratingAll || isGeneratingAllImages}
                                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isFillingAll ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                Fill All
                            </button>
                            <button
                                onClick={handleFillMissingAudio}
                                disabled={isGeneratingAll || isFillingAll}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isGeneratingAll ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                                Fill Audio
                            </button>
                            {enableDialogueImages && (
                                <button
                                    onClick={handleFillMissingImages}
                                    disabled={isGeneratingAllImages || isFillingAll}
                                    className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {isGeneratingAllImages ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
                                    Fill Images
                                </button>
                            )}
                            {hasAudio && (
                                <button
                                    onClick={handleExportWav}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium flex items-center gap-1.5"
                                >
                                    <Download size={14} /> Export WAV
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {items.map((item, index) => {
                            const castMember = item.character ? cast.find(c => c.name === item.character) : undefined;
                            return (
                                <ScriptItemCard
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    totalItems={items.length}
                                    assignedVoice={castMember?.voice}
                                    voiceType={castMember?.voiceType === 'elevenlabs' ? 'elevenlabs' : 'gemini'}
                                    elevenLabsApiKey={elevenLabsApiKey}
                                    enableDialogueImages={enableDialogueImages}
                                    onUpdate={(id, updates) => handleUpdateItem(id, updates)}
                                    onRemove={(id) => handleRemoveItem(id)}
                                    onMove={(idx, direction) => handleMoveItem(idx, direction)}
                                    onGenerateAudio={handleGenerateAudio}
                                    onGenerateSfx={handleGenerateSfx}
                                    onGenerateImage={() => handleGenerateItemImage(item.id)}
                                    onUploadImage={(id, file) => handleImageUpload('item', id, file)}
                                    onImageClick={(img) => setZoomedImage(img)}
                                    onPreviewAudio={handlePreviewAudio}
                                    isPlaying={isPlaying} // TODO: Track individual item playing state
                                    isGeneratingImage={generatingImageFor === `item:${item.id}`}
                                />
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Batch Generate Tools */}
            {items.length > 0 && (
                <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Wand2 size={20} className="text-purple-400" />
                        <div>
                            <h3 className="text-sm font-bold text-zinc-100">Batch Tools</h3>
                            <p className="text-xs text-zinc-500">Quickly fill missing content</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleFillMissingAudio}
                            disabled={isGeneratingAll || !items.some(i => !i.audioBuffer)}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            <Volume2 size={14} />
                            Fill Audio
                        </button>
                        {enableDialogueImages && (
                            <button
                                onClick={handleFillMissingImages}
                                disabled={isGeneratingAllImages || !items.some(i => !i.imageBase64 && i.type === ItemType.SPEECH)}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                <Image size={14} />
                                Fill Images
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* Player */}
            {hasAudio && (
                <Player
                    items={items}
                    isPlaying={isPlaying}
                    enableSfx={enableSfx}
                    onPlayStateChange={(playing, currentId) => {
                        setIsPlaying(playing);
                        setCurrentPlayingId(currentId);
                    }}
                />
            )}

            {/* Podcast Publish Section */}
            {items.length > 0 && (
                <PodcastPublishSection
                    ref={podcastPublishRef}
                    storyText={storyText}
                    items={items}
                    geminiApiKey={geminiApiKey}
                    podcastInfo={podcastInfo}
                    onGenerateAllAudio={handleFillMissingAudio}
                    onGeneratingChange={(isGen) => setIsGeneratingAll(isGen)}
                    isYouTubeLoggedIn={isYouTubeLoggedIn}
                    selectedPlaylistId={selectedPlaylistId}
                    youtubePlaylists={youtubePlaylists}
                    imageModel={imageModel}
                    imageProvider={imageProvider}
                    mp3Blob={mp3Blob}
                    setMp3Blob={setMp3Blob}
                    webmBlob={webmBlob}
                    setWebmBlob={setWebmBlob}
                    rssZipBlob={rssZipBlob}
                    setRssZipBlob={setRssZipBlob}
                    coverArtBase64={coverArtBase64}
                    setCoverArtBase64={setCoverArtBase64}
                    onUploadStateChange={handleUploadStateChange}
                />
            )}

            {/* Image Lightbox */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setZoomedImage(null)}
                >
                    <div className="relative max-w-full max-h-full">
                        <img
                            src={`data:image/png;base64,${zoomedImage}`}
                            alt="Zoomed"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            className="absolute -top-4 -right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(null);
                            }}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
