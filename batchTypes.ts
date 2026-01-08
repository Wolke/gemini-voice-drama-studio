/**
 * Batch Mode Types
 * Types for batch processing jobs
 */

import { CastMember, SceneDefinition, ScriptItem, GeneratedPodcastInfo } from './types';

export type BatchJobStatus =
    | 'pending'        // 等待生成腳本
    | 'script_ready'   // 腳本已生成
    | 'generating'     // 生成檔案中
    | 'files_ready'    // 檔案已生成
    | 'uploading'      // 上傳中
    | 'uploaded'       // 已上傳
    | 'error';         // 發生錯誤

export interface BatchJobScriptData {
    cast: CastMember[];
    scenes: SceneDefinition[];
    items: ScriptItem[];
    podcastInfo: GeneratedPodcastInfo | null;
}

export interface BatchJobFiles {
    mp3Key?: string;          // IndexedDB key for MP3 blob
    webmKey?: string;         // IndexedDB key for WebM blob
    coverKey?: string;        // IndexedDB key for cover art base64
}

export interface BatchJob {
    id: string;
    storyText: string;
    status: BatchJobStatus;
    createdAt: number;
    updatedAt: number;

    // Podcast metadata (user-editable)
    podcastTitle?: string;
    podcastAuthor?: string;
    episodeTitle?: string;
    podcastDescription?: string;
    coverPrompt?: string;

    // Script data (from AI generation)
    scriptData?: BatchJobScriptData;

    // Generated files references
    files?: BatchJobFiles;

    // YouTube upload status
    youtubeVideoId?: string;
    youtubeUrl?: string;
    uploadedAt?: number;

    // Error tracking
    error?: string;
}

// Page navigation type
export type AppPage = 'batch' | 'studio' | 'config';
