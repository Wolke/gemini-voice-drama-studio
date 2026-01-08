/**
 * BatchPage Component
 * Batch job management page for creating and processing multiple stories
 */

import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Edit3, Loader2, CheckCircle, AlertCircle,
    FileText, Wand2, Film, Youtube, Clock, Download, Music, Video,
    Sparkles, X, Check, ChevronDown, ChevronUp, Rocket
} from 'lucide-react';
import { BatchJob, BatchJobStatus, AppPage } from '../batchTypes';
import {
    loadBatchJobs, addBatchJob, deleteBatchJob, updateBatchJob,
    loadAudioBlob
} from '../services/batchStorageService';
import { generateStoriesFromTopic, StoryPreset, GeneratedStory } from '../services/geminiService';

interface BatchPageProps {
    onNavigate: (page: AppPage, jobId?: string) => void;
    geminiApiKey: string;
    elevenLabsApiKey: string;
    isYouTubeLoggedIn: boolean;
    geminiModel: string;
    onGenerateScript: (job: BatchJob, onProgress?: (msg: string) => void) => Promise<BatchJob>;
    onGenerateFiles: (job: BatchJob, onProgress?: (msg: string) => void) => Promise<BatchJob>;
    onUploadToYouTube: (job: BatchJob, onProgress?: (msg: string) => void) => Promise<BatchJob>;
}

const STATUS_CONFIG: Record<BatchJobStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending', color: 'text-zinc-400', icon: <Clock size={14} /> },
    script_ready: { label: 'Script Ready', color: 'text-blue-400', icon: <FileText size={14} /> },
    generating: { label: 'Generating', color: 'text-amber-400', icon: <Loader2 size={14} className="animate-spin" /> },
    files_ready: { label: 'Files Ready', color: 'text-purple-400', icon: <Film size={14} /> },
    uploading: { label: 'Uploading', color: 'text-cyan-400', icon: <Loader2 size={14} className="animate-spin" /> },
    uploaded: { label: 'Uploaded', color: 'text-green-400', icon: <CheckCircle size={14} /> },
    error: { label: 'Error', color: 'text-red-400', icon: <AlertCircle size={14} /> },
};

export const BatchPage: React.FC<BatchPageProps> = ({
    onNavigate,
    geminiApiKey,
    isYouTubeLoggedIn,
    geminiModel,
    onGenerateScript,
    onGenerateFiles,
    onUploadToYouTube,
}) => {
    const [jobs, setJobs] = useState<BatchJob[]>([]);
    const [newStory, setNewStory] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingType, setProcessingType] = useState<'scripts' | 'files' | 'upload' | 'auto' | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [currentJobIndex, setCurrentJobIndex] = useState<number>(0);
    const [totalJobs, setTotalJobs] = useState<number>(0);

    // Topic Generator State
    const [showTopicGenerator, setShowTopicGenerator] = useState(false);
    const [topicInput, setTopicInput] = useState('');
    const [storyCount, setStoryCount] = useState(10);
    const [selectedPreset, setSelectedPreset] = useState<StoryPreset>('jokes');
    const [customStyle, setCustomStyle] = useState('');
    const [exampleReference, setExampleReference] = useState('');
    const [generatedStories, setGeneratedStories] = useState<GeneratedStory[]>([]);
    const [selectedStories, setSelectedStories] = useState<Set<number>>(new Set());
    const [expandedStories, setExpandedStories] = useState<Set<number>>(new Set());
    const [isGeneratingStories, setIsGeneratingStories] = useState(false);

    const PRESET_OPTIONS: { value: StoryPreset; label: string; emoji: string }[] = [
        { value: 'jokes', label: 'Jokes', emoji: '😂' },
        { value: 'news', label: 'Visual News', emoji: '📰' },
        { value: 'horror', label: 'Horror', emoji: '👻' },
        { value: 'heartwarming', label: 'Heartwarming', emoji: '💖' },
        { value: 'adventure', label: 'Adventure', emoji: '⚔️' },
        { value: 'custom', label: 'Custom Style', emoji: '✏️' },
    ];

    // Load jobs on mount
    useEffect(() => {
        setJobs(loadBatchJobs());
    }, []);

    // Topic Generator Functions
    const handleGenerateFromTopic = async () => {
        if (!topicInput.trim()) {
            alert('Please enter a topic');
            return;
        }

        // Check API key
        if (!geminiApiKey) {
            alert('Please set Gemini API Key first');
            return;
        }

        setIsGeneratingStories(true);
        setGeneratedStories([]);
        setSelectedStories(new Set());

        try {
            const stories = await generateStoriesFromTopic(
                topicInput.trim(),
                storyCount,
                selectedPreset,
                customStyle,
                exampleReference,
                geminiApiKey,
                geminiModel
            );

            setGeneratedStories(stories);
            // Select all by default
            setSelectedStories(new Set(stories.map((_, i) => i)));
        } catch (error: any) {
            alert(`Generation failed: ${error.message}`);
        } finally {
            setIsGeneratingStories(false);
        }
    };

    const toggleStorySelection = (index: number) => {
        setSelectedStories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const toggleStoryExpand = (index: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering selection
        setExpandedStories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleAddGeneratedStories = () => {
        const storiesToAdd = generatedStories.filter((_, i) => selectedStories.has(i));
        if (storiesToAdd.length === 0) {
            alert('Please select at least one story');
            return;
        }

        let updatedJobs = jobs;
        for (const story of storiesToAdd) {
            const job: BatchJob = {
                id: crypto.randomUUID(),
                storyText: `${story.title}\n\n${story.content}`,
                episodeTitle: story.title,
                status: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            updatedJobs = addBatchJob(job);
        }

        setJobs(updatedJobs);
        setGeneratedStories([]);
        setSelectedStories(new Set());
        setShowTopicGenerator(false);
        setTopicInput('');
    };

    const handleAddJob = () => {
        if (!newStory.trim()) return;

        const job: BatchJob = {
            id: crypto.randomUUID(),
            storyText: newStory.trim(),
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const updatedJobs = addBatchJob(job);
        setJobs(updatedJobs);
        setNewStory('');
    };

    const handleDeleteJob = async (id: string) => {
        if (!confirm('Are you sure you want to delete this job? (Associated audio files will also be deleted)')) return;
        const updatedJobs = await deleteBatchJob(id);
        setJobs(updatedJobs);
    };

    const handleEditJob = (jobId: string) => {
        onNavigate('studio', jobId);
    };

    // Download handlers
    const handleDownloadMp3 = async (job: BatchJob) => {
        if (!job.files?.mp3Key) return;
        const blob = await loadAudioBlob(job.files.mp3Key);
        if (!blob) {
            alert('MP3 file not found');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.episodeTitle || 'episode'}.mp3`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadWebm = async (job: BatchJob) => {
        if (!job.files?.webmKey) return;
        const blob = await loadAudioBlob(job.files.webmKey);
        if (!blob) {
            alert('WebM file not found');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.episodeTitle || 'episode'}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Batch generate all scripts
    const handleGenerateAllScripts = async () => {
        const pendingJobs = jobs.filter(j => j.status === 'pending');
        if (pendingJobs.length === 0) {
            alert('No pending tasks');
            return;
        }

        setIsProcessing(true);
        setProcessingType('scripts');
        setTotalJobs(pendingJobs.length);

        for (let i = 0; i < pendingJobs.length; i++) {
            const job = pendingJobs[i];
            setCurrentJobIndex(i + 1);
            setProgressMessage(`Generating script ${i + 1}/${pendingJobs.length}...`);

            try {
                const updatedJob = await onGenerateScript(job, (msg) => setProgressMessage(msg));
                setJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));
            } catch (e: any) {
                console.error('Script generation error:', e);
                const errorJobs = updateBatchJob(job.id, { status: 'error', error: e.message });
                setJobs(errorJobs);
            }
        }

        setIsProcessing(false);
        setProcessingType(null);
        setProgressMessage('');
    };

    // Batch generate all files
    const handleGenerateAllFiles = async () => {
        const readyJobs = jobs.filter(j => j.status === 'script_ready');
        if (readyJobs.length === 0) {
            alert('No jobs ready for file generation');
            return;
        }

        setIsProcessing(true);
        setProcessingType('files');
        setTotalJobs(readyJobs.length);

        for (let i = 0; i < readyJobs.length; i++) {
            const job = readyJobs[i];
            setCurrentJobIndex(i + 1);
            setProgressMessage(`Generating files ${i + 1}/${readyJobs.length}...`);

            try {
                const updatedJob = await onGenerateFiles(job, (msg) => setProgressMessage(`[${i + 1}/${readyJobs.length}] Files: ${msg}`));
                setJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));
            } catch (e: any) {
                console.error('File generation error:', e);
                const errorJobs = updateBatchJob(job.id, { status: 'error', error: e.message });
                setJobs(errorJobs);
            }
        }

        setIsProcessing(false);
        setProcessingType(null);
        setProgressMessage('');
    };

    // Batch upload to YouTube
    const handleUploadAll = async () => {
        if (!isYouTubeLoggedIn) {
            alert('Please login to YouTube first');
            return;
        }

        const readyJobs = jobs.filter(j => j.status === 'files_ready');
        if (readyJobs.length === 0) {
            alert('No jobs ready for upload');
            return;
        }

        setIsProcessing(true);
        setProcessingType('upload');
        setTotalJobs(readyJobs.length);

        for (let i = 0; i < readyJobs.length; i++) {
            const job = readyJobs[i];
            setCurrentJobIndex(i + 1);
            setProgressMessage(`Uploading ${i + 1}/${readyJobs.length}: ${job.episodeTitle || 'Untitled'}...`);

            try {
                const updatedJob = await onUploadToYouTube(job, (msg) => setProgressMessage(msg));
                setJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));
            } catch (e: any) {
                console.error('Upload error:', e);
                const errorJobs = updateBatchJob(job.id, { status: 'error', error: e.message });
                setJobs(errorJobs);
            }
        }

        setIsProcessing(false);
        setProcessingType(null);
        setProgressMessage('');
    };

    // Auto process all (Generate Scripts -> Generate Files -> Upload)
    const handleAutoProcessAll = async () => {
        const pendingJobs = jobs.filter(j => j.status === 'pending');
        if (pendingJobs.length === 0) {
            alert('No pending jobs');
            return;
        }

        if (!isYouTubeLoggedIn) {
            alert('Please login to YouTube first to use Auto Process');
            return;
        }

        setIsProcessing(true);
        setProcessingType('auto');
        setTotalJobs(pendingJobs.length);

        for (let i = 0; i < pendingJobs.length; i++) {
            let job = pendingJobs[i];
            setCurrentJobIndex(i + 1);

            try {
                // 1. Generate Script
                setProgressMessage(`Processing ${i + 1}/${pendingJobs.length}: Generating script...`);
                job = await onGenerateScript(job, (msg) => setProgressMessage(`[${i + 1}/${pendingJobs.length}] Script: ${msg}`));

                // Update state after script generation
                setJobs(prev => prev.map(j => j.id === job.id ? job : j));

                // 2. Generate Files
                setProgressMessage(`Processing ${i + 1}/${pendingJobs.length}: Generating files...`);
                job = await onGenerateFiles(job, (msg) => setProgressMessage(`[${i + 1}/${pendingJobs.length}] Files: ${msg}`));

                // Update state after file generation
                setJobs(prev => prev.map(j => j.id === job.id ? job : j));

                // 3. Upload to YouTube
                setProgressMessage(`Processing ${i + 1}/${pendingJobs.length}: Uploading to YouTube...`);
                job = await onUploadToYouTube(job, (msg) => setProgressMessage(`[${i + 1}/${pendingJobs.length}] Upload: ${msg}`));

                // Final update
                setJobs(prev => prev.map(j => j.id === job.id ? job : j));

            } catch (e: any) {
                console.error('Auto process error:', e);
                const errorJobs = updateBatchJob(job.id, { status: 'error', error: e.message });
                setJobs(errorJobs);
                // Continue to next job despite error
            }
        }

        setIsProcessing(false);
        setProcessingType(null);
        setProgressMessage('');
    };

    const pendingCount = jobs.filter(j => j.status === 'pending').length;
    const scriptReadyCount = jobs.filter(j => j.status === 'script_ready').length;
    const filesReadyCount = jobs.filter(j => j.status === 'files_ready').length;
    const uploadedCount = jobs.filter(j => j.status === 'uploaded').length;
    const hasApiKey = !!geminiApiKey;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Batch Processing</h2>
                    <p className="text-zinc-500 text-sm">Batch generate and upload multiple podcasts</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <span className="px-2 py-1 bg-zinc-800 rounded">{jobs.length} Total Jobs</span>
                    <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded">{uploadedCount} Uploaded</span>
                </div>
            </div>

            {/* Progress Indicator */}
            {isProcessing && progressMessage && (
                <div className="p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                        <Loader2 className="animate-spin text-blue-400" size={20} />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-blue-300">{progressMessage}</p>
                            <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                    style={{ width: `${(currentJobIndex / totalJobs) * 100}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-sm text-zinc-400">{currentJobIndex}/{totalJobs}</span>
                    </div>
                </div>
            )}

            {/* New Story Input / Topic Generator */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-4">
                {/* Mode Tabs */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTopicGenerator(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${!showTopicGenerator
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                    >
                        <Plus size={16} /> Add Single
                    </button>
                    <button
                        onClick={() => setShowTopicGenerator(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${showTopicGenerator
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                    >
                        <Sparkles size={16} /> Topic Generator
                    </button>
                </div>

                {/* Manual Input Mode */}
                {!showTopicGenerator && (
                    <div className="space-y-3">
                        <textarea
                            value={newStory}
                            onChange={(e) => setNewStory(e.target.value)}
                            placeholder="Paste story content here..."
                            className="w-full h-32 bg-black/40 border border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
                        />
                        <button
                            onClick={handleAddJob}
                            disabled={!newStory.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Plus size={16} /> Add to Batch
                        </button>
                    </div>
                )}

                {/* Topic Generator Mode */}
                {showTopicGenerator && (
                    <div className="space-y-4">
                        {/* Topic & Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs text-zinc-500 mb-1">Topic</label>
                                <input
                                    type="text"
                                    value={topicInput}
                                    onChange={(e) => setTopicInput(e.target.value)}
                                    placeholder="e.g. Taiwan Urban Legends, Office Daily Life, School Life..."
                                    className="w-full bg-black/40 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Count</label>
                                <input
                                    type="number"
                                    value={storyCount}
                                    onChange={(e) => setStoryCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                                    min={1}
                                    max={100}
                                    className="w-full bg-black/40 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                />
                            </div>
                        </div>

                        {/* Preset Selection */}
                        <div>
                            <label className="block text-xs text-zinc-500 mb-2">Style</label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_OPTIONS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        onClick={() => setSelectedPreset(preset.value)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${selectedPreset === preset.value
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                    >
                                        <span>{preset.emoji}</span> {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Style Input */}
                        {selectedPreset === 'custom' && (
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Custom Style Description</label>
                                <textarea
                                    value={customStyle}
                                    onChange={(e) => setCustomStyle(e.target.value)}
                                    placeholder="Describe your desired style, e.g. satirical dark humor..."
                                    className="w-full h-20 bg-black/40 border border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:border-purple-500 resize-none"
                                />
                            </div>
                        )}

                        {/* Example Reference */}
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">
                                📝 Example Reference (Optional)
                            </label>
                            <textarea
                                value={exampleReference}
                                onChange={(e) => setExampleReference(e.target.value)}
                                placeholder="Paste 1-2 example stories. The AI will refer to their writing style, format, and tone..."
                                className="w-full h-28 bg-black/40 border border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:border-purple-500 resize-none"
                            />
                            <p className="text-xs text-zinc-600 mt-1">
                                💡 Tip: Providing examples helps match your desired story style
                            </p>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerateFromTopic}
                            disabled={isGeneratingStories || !topicInput.trim() || !hasApiKey}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isGeneratingStories ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Generating with {geminiModel}...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Generate {storyCount} stories with {geminiModel}
                                </>
                            )}
                        </button>

                        {/* Generated Stories Preview */}
                        {generatedStories.length > 0 && (
                            <div className="space-y-3 border-t border-zinc-700 pt-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-zinc-300">
                                        Preview ({selectedStories.size}/{generatedStories.length} Selected)
                                    </h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedStories(new Set(generatedStories.map((_, i) => i)))}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={() => setSelectedStories(new Set())}
                                            className="text-xs text-zinc-400 hover:text-white"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-64 overflow-y-auto space-y-2">
                                    {generatedStories.map((story, index) => {
                                        const isExpanded = expandedStories.has(index);
                                        return (
                                            <div
                                                key={index}
                                                onClick={() => toggleStorySelection(index)}
                                                className={`p-3 rounded-lg cursor-pointer transition-all ${selectedStories.has(index)
                                                    ? 'bg-purple-900/30 border border-purple-500/50'
                                                    : 'bg-zinc-800/50 border border-transparent hover:border-zinc-600'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-1 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${selectedStories.has(index)
                                                        ? 'bg-purple-500'
                                                        : 'bg-zinc-700'
                                                        }`}>
                                                        {selectedStories.has(index) && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="font-medium text-sm text-white truncate">{story.title}</p>
                                                            <button
                                                                onClick={(e) => toggleStoryExpand(index, e)}
                                                                className="flex-shrink-0 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-900/30 transition-colors"
                                                            >
                                                                {isExpanded ? (
                                                                    <>
                                                                        <ChevronUp size={14} /> Collapse
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <ChevronDown size={14} /> Expand
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                        <p className={`text-xs text-zinc-400 mt-1 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                            {story.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add to Batch Button */}
                                <button
                                    onClick={handleAddGeneratedStories}
                                    disabled={selectedStories.size === 0}
                                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} />
                                    Add {selectedStories.size} stories to batch
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Batch Action Buttons */}
            <div className="space-y-3">
                <button
                    onClick={handleAutoProcessAll}
                    disabled={isProcessing || pendingCount === 0 || !hasApiKey || !isYouTubeLoggedIn}
                    className="w-full py-4 bg-gradient-to-r from-green-600 via-teal-600 to-emerald-600 hover:from-green-500 hover:via-teal-500 hover:to-emerald-500 text-white rounded-lg font-bold text-lg shadow-lg shadow-green-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {processingType === 'auto' ? <Loader2 className="animate-spin" size={24} /> : <Rocket size={24} />}
                    <div className="flex flex-col items-start leading-none">
                        <span>Auto Process (Generate + Upload)</span>
                        <span className="text-xs opacity-80 font-normal mt-1">Complete all steps for {pendingCount} jobs with one click</span>
                    </div>
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={handleGenerateAllScripts}
                        disabled={isProcessing || pendingCount === 0 || !hasApiKey}
                        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {processingType === 'scripts' ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                        Generate All Scripts ({pendingCount})
                    </button>
                    <button
                        onClick={handleGenerateAllFiles}
                        disabled={isProcessing || scriptReadyCount === 0}
                        className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {processingType === 'files' ? <Loader2 className="animate-spin" size={18} /> : <Film size={18} />}
                        Generate All Files ({scriptReadyCount})
                    </button>
                    <button
                        onClick={handleUploadAll}
                        disabled={isProcessing || filesReadyCount === 0 || !isYouTubeLoggedIn}
                        className="flex-1 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {processingType === 'upload' ? <Loader2 className="animate-spin" size={18} /> : <Youtube size={18} />}
                        Upload All ({filesReadyCount})
                    </button>
                </div>
            </div>

            {/* Job List */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Job List</h3>

                {jobs.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        No jobs yet. Add a story to get started.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {jobs.map((job) => {
                            const statusConfig = STATUS_CONFIG[job.status];
                            const hasFiles = job.files?.mp3Key || job.files?.webmKey;
                            return (
                                <div
                                    key={job.id}
                                    className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
                                >
                                    {/* Status */}
                                    <div className={`flex items-center gap-1.5 min-w-[100px] ${statusConfig.color}`}>
                                        {statusConfig.icon}
                                        <span className="text-sm">{statusConfig.label}</span>
                                    </div>

                                    {/* Story preview / Episode title */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-300 truncate">
                                            {job.episodeTitle || job.storyText.slice(0, 100)}...
                                        </p>
                                        <p className="text-xs text-zinc-600">
                                            {new Date(job.createdAt).toLocaleString('en-US')}
                                        </p>
                                    </div>

                                    {/* Download buttons if files exist */}
                                    {hasFiles && (
                                        <div className="flex gap-1">
                                            {job.files?.mp3Key && (
                                                <button
                                                    onClick={() => handleDownloadMp3(job)}
                                                    className="p-2 hover:bg-green-900/30 rounded transition-colors text-green-400"
                                                    title="Download MP3"
                                                >
                                                    <Music size={14} />
                                                </button>
                                            )}
                                            {job.files?.webmKey && (
                                                <button
                                                    onClick={() => handleDownloadWebm(job)}
                                                    className="p-2 hover:bg-purple-900/30 rounded transition-colors text-purple-400"
                                                    title="Download WebM"
                                                >
                                                    <Video size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* YouTube link if uploaded */}
                                    {job.youtubeUrl && (
                                        <a
                                            href={job.youtubeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/30 transition-colors"
                                        >
                                            YouTube ↗
                                        </a>
                                    )}

                                    {/* Error message */}
                                    {job.error && (
                                        <span className="text-xs text-red-400 max-w-[150px] truncate" title={job.error}>
                                            {job.error}
                                        </span>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditJob(job.id)}
                                            className="p-2 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white"
                                            title="Edit"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteJob(job.id)}
                                            className="p-2 hover:bg-red-900/30 rounded transition-colors text-zinc-400 hover:text-red-400"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
