import React, { useState, useCallback } from 'react';
import { CastMember, SceneDefinition, ScriptItem, GeneratedPodcastInfo } from '../types';
import { BatchJob } from '../batchTypes';
import { getAudioContext, decodeRawPCM, decodeAudioFile } from '../utils/audioUtils';

export interface DramaData {
    storyText: string;
    setStoryText: (text: string) => void;
    cast: CastMember[];
    setCast: React.Dispatch<React.SetStateAction<CastMember[]>>;
    scenes: SceneDefinition[];
    setScenes: React.Dispatch<React.SetStateAction<SceneDefinition[]>>;
    items: ScriptItem[];
    setItems: React.Dispatch<React.SetStateAction<ScriptItem[]>>;
    podcastInfo: GeneratedPodcastInfo | null;
    setPodcastInfo: (info: GeneratedPodcastInfo | null) => void;
    coverArtBase64: string | null;
    setCoverArtBase64: (base64: string | null) => void;

    // Actions
    loadFromJob: (job: BatchJob) => Promise<void>;
    restoreDraft: () => Promise<void>;
}

export const useDramaData = (): DramaData => {
    const [storyText, setStoryText] = useState('');
    const [cast, setCast] = useState<CastMember[]>([]);
    const [scenes, setScenes] = useState<SceneDefinition[]>([]);
    const [items, setItems] = useState<ScriptItem[]>([]);
    const [podcastInfo, setPodcastInfo] = useState<GeneratedPodcastInfo | null>(null);
    const [coverArtBase64, setCoverArtBase64] = useState<string | null>(null);

    const loadFromJob = useCallback(async (job: BatchJob) => {
        setStoryText(job.storyText);

        if (job.scriptData) {
            setCast(job.scriptData.cast);
            // CRITICAL FIX: Ensure scenes are loaded
            setScenes(job.scriptData.scenes || []);
            setPodcastInfo(job.scriptData.podcastInfo);

            // Load audio for each item from IndexedDB
            const loadedItems = await Promise.all(
                job.scriptData.items.map(async (item) => {
                    if (item.audioKey) {
                        try {
                            const { loadItemAudioBase64 } = await import('../services/batchStorageService');
                            const base64 = await loadItemAudioBase64(item.audioKey);
                            if (base64) {
                                const ctx = getAudioContext();
                                let buffer: AudioBuffer;
                                if (item.audioFormat === 'pcm') {
                                    buffer = await decodeRawPCM(base64, ctx);
                                } else {
                                    buffer = await decodeAudioFile(base64, ctx);
                                }
                                return { ...item, audioBuffer: buffer };
                            }
                        } catch (e) {
                            console.error('Failed to load audio for item:', item.id, e);
                        }
                    }
                    return item;
                })
            );

            setItems(loadedItems);
        }

        // Load cover art from IndexedDB
        if (job.files?.coverKey) {
            try {
                const { loadItemAudioBase64 } = await import('../services/batchStorageService');
                const coverData = await loadItemAudioBase64(job.files.coverKey);
                if (coverData) {
                    setCoverArtBase64(coverData);
                }
            } catch (e) {
                console.error('Failed to load cover art:', e);
            }
        }
    }, []);

    const restoreDraft = useCallback(async () => {
        try {
            const { loadDraft } = await import('../services/batchStorageService');
            const { getAudioContext } = await import('../utils/audioUtils');

            const data = await loadDraft();
            if (data) {
                // Restore state
                if (data.storyText) setStoryText(data.storyText);
                if (data.cast) setCast(data.cast);
                if (data.scenes) setScenes(data.scenes);
                if (data.podcastInfo) setPodcastInfo(data.podcastInfo);
                if (data.coverArtBase64) setCoverArtBase64(data.coverArtBase64);

                // Restore items (and audio)
                if (data.items) {
                    const audioContext = getAudioContext();
                    const restoredItems = await Promise.all(data.items.map(async (item: any) => {
                        // If we have a saved blob but no buffer, decode it
                        if (item.draftAudioBlob && !item.audioBuffer) {
                            try {
                                const arrayBuffer = await item.draftAudioBlob.arrayBuffer();
                                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                                // Remove the blob from memory state, keep audioBuffer
                                const { draftAudioBlob, ...rest } = item;
                                return { ...rest, audioBuffer };
                            } catch (e) {
                                console.warn('[Draft] Failed to decode audio for item', e);
                                return item;
                            }
                        }
                        return item;
                    }));
                    setItems(restoredItems);
                }
                console.log('[Draft] Restored from IndexedDB');
            }
        } catch (e) {
            console.warn('[Draft] Failed to load draft:', e);
        }
    }, []);

    return {
        storyText, setStoryText,
        cast, setCast,
        scenes, setScenes,
        items, setItems,
        podcastInfo, setPodcastInfo,
        coverArtBase64, setCoverArtBase64,
        loadFromJob,
        restoreDraft
    };
};
