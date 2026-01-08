/**
 * Batch Storage Service
 * Handles localStorage for job metadata and IndexedDB for large audio files
 */

import { BatchJob } from '../batchTypes';

const BATCH_JOBS_KEY = 'batchJobs';
const DB_NAME = 'VoiceDramaDB';
const DB_VERSION = 1;
const AUDIO_STORE = 'audioFiles';

// ==================== localStorage (Job Metadata) ====================

export function loadBatchJobs(): BatchJob[] {
    try {
        const data = localStorage.getItem(BATCH_JOBS_KEY);
        if (!data) return [];
        return JSON.parse(data) as BatchJob[];
    } catch (e) {
        console.error('Failed to load batch jobs:', e);
        return [];
    }
}

export function saveBatchJobs(jobs: BatchJob[]): void {
    try {
        localStorage.setItem(BATCH_JOBS_KEY, JSON.stringify(jobs));
    } catch (e) {
        console.error('Failed to save batch jobs:', e);
    }
}

export function addBatchJob(job: BatchJob): BatchJob[] {
    const jobs = loadBatchJobs();
    jobs.push(job);
    saveBatchJobs(jobs);
    return jobs;
}

export function updateBatchJob(id: string, updates: Partial<BatchJob>): BatchJob[] {
    const jobs = loadBatchJobs();
    const index = jobs.findIndex(j => j.id === id);
    if (index !== -1) {
        jobs[index] = { ...jobs[index], ...updates, updatedAt: Date.now() };
        saveBatchJobs(jobs);
    }
    return jobs;
}

export async function deleteBatchJob(id: string): Promise<BatchJob[]> {
    // First, get the job to find audio keys that need to be deleted
    const job = getBatchJob(id);
    if (job) {
        // Delete all associated audio files from IndexedDB
        await deleteJobAudioFiles(job);
    }

    // Then delete from localStorage
    let jobs = loadBatchJobs();
    jobs = jobs.filter(j => j.id !== id);
    saveBatchJobs(jobs);
    return jobs;
}

// Delete all audio files associated with a batch job
export async function deleteJobAudioFiles(job: BatchJob): Promise<void> {
    const keysToDelete: string[] = [];

    // Collect MP3, WebM, and cover keys
    if (job.files?.mp3Key) keysToDelete.push(job.files.mp3Key);
    if (job.files?.webmKey) keysToDelete.push(job.files.webmKey);
    if (job.files?.coverKey) keysToDelete.push(job.files.coverKey);

    // Collect individual item audio keys
    if (job.scriptData?.items) {
        for (const item of job.scriptData.items) {
            if (item.audioKey) {
                keysToDelete.push(item.audioKey);
            }
        }
    }

    // Delete all audio files
    for (const key of keysToDelete) {
        try {
            await deleteAudioBlob(key);
        } catch (e) {
            console.error('Failed to delete audio:', key, e);
        }
    }
}

export function getBatchJob(id: string): BatchJob | null {
    const jobs = loadBatchJobs();
    return jobs.find(j => j.id === id) || null;
}

// ==================== IndexedDB (Large Audio Files) ====================

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(AUDIO_STORE)) {
                db.createObjectStore(AUDIO_STORE);
            }
        };
    });
}

export async function saveAudioBlob(key: string, blob: Blob): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_STORE);
        const request = store.put(blob, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();

        tx.oncomplete = () => db.close();
    });
}

export async function loadAudioBlob(key: string): Promise<Blob | null> {
    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE, 'readonly');
            const store = tx.objectStore(AUDIO_STORE);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);

            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        console.error('Failed to load audio blob:', e);
        return null;
    }
}

export async function deleteAudioBlob(key: string): Promise<void> {
    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE, 'readwrite');
            const store = tx.objectStore(AUDIO_STORE);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();

            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        console.error('Failed to delete audio blob:', e);
    }
}

// Helper to generate unique keys for audio files
export function generateAudioKey(jobId: string, type: 'mp3' | 'webm'): string {
    return `${jobId}_${type}_${Date.now()}`;
}

// Generate key for individual item audio
export function generateItemAudioKey(jobId: string, itemId: string): string {
    return `${jobId}_item_${itemId}`;
}

// Save audio base64 for a script item (uses string storage, not blob)
export async function saveItemAudioBase64(key: string, base64: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_STORE);
        const request = store.put(base64, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();

        tx.oncomplete = () => db.close();
    });
}

// Load audio base64 for a script item
export async function loadItemAudioBase64(key: string): Promise<string | null> {
    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE, 'readonly');
            const store = tx.objectStore(AUDIO_STORE);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);

            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        console.error('Failed to load item audio:', e);
        return null;
    }
}

// ==================== Draft Storage (IndexedDB) ====================

const CURRENT_DRAFT_KEY = 'studio_current_draft';

// Save the entire draft object to IndexedDB
export async function saveDraft(draftData: any): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_STORE);
        // We use the same store as audio files since it allows large objects
        const request = store.put(draftData, CURRENT_DRAFT_KEY);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();

        tx.oncomplete = () => db.close();
    });
}

// Load the draft object from IndexedDB
export async function loadDraft(): Promise<any | null> {
    try {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE, 'readonly');
            const store = tx.objectStore(AUDIO_STORE);
            const request = store.get(CURRENT_DRAFT_KEY);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);

            tx.oncomplete = () => db.close();
        });
    } catch (e) {
        console.error('Failed to load draft:', e);
        return null;
    }
}
