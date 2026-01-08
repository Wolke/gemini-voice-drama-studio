/**
 * App.tsx - Main Application Controller
 * Handles page navigation and shared state management
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Layers, Edit3, Settings2
} from 'lucide-react';
import { LlmProvider, TtsProvider, GeminiModel, ElevenLabsVoice, ImageAspectRatio, ImageStylePreset, ImageModel, ImageProvider, DialogueVisualMode, VeoModel, VideoResolution, VideoDuration } from './types';
import { AppPage, BatchJob } from './batchTypes';

import { BatchPage } from './pages/BatchPage';
import { StudioPage } from './pages/StudioPage';
import { ConfigPage } from './pages/ConfigPage';
import { fetchElevenLabsVoices } from './services/elevenLabsService';
import { generateScriptFromStory } from './services/geminiService';
import { updateBatchJob, loadBatchJobs, saveAudioBlob, generateAudioKey, loadAudioBlob, generateItemAudioKey, saveItemAudioBase64, loadItemAudioBase64 } from './services/batchStorageService';
import {
  initiateYouTubeAuth,
  isYouTubeAuthenticated,
  clearYouTubeAuth,
  getYouTubeAccessToken,
  listChannels,
  listPlaylists,
  YouTubeChannel,
  YouTubePlaylist,
  uploadToYouTube,
  addVideoToPlaylist
} from './services/youtubeService';
import { mergeAudioBuffers, bufferToWav, bufferToMp3, createWebmVideo, getAudioContext, decodeAudioFile, decodeRawPCM } from './utils/audioUtils';
import { generatePodcastCoverArt } from './services/podcastService';
import { generateSpeech } from './services/geminiService';
import { generateElevenLabsSfx, generateElevenLabsSpeech } from './services/elevenLabsService';


// Import TTS registry for provider-agnostic speech generation
import { ttsRegistry, TtsConfig } from './lib/tts';


export default function App() {
  // Navigation state
  const [currentPage, setCurrentPage] = useState<AppPage>('batch');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  // API Keys state
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('elevenLabsApiKey') || '');


  const [saveGeminiKey, setSaveGeminiKey] = useState(() => localStorage.getItem('saveGeminiKey') === 'true');
  const [saveElevenLabsKey, setSaveElevenLabsKey] = useState(() => localStorage.getItem('saveElevenLabsKey') === 'true');


  // Provider and model state
  const [llmProvider, setLlmProvider] = useState<LlmProvider>(() => (localStorage.getItem('llmProvider') as LlmProvider) || 'gemini');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(() => (localStorage.getItem('ttsProvider') as TtsProvider) || 'gemini');
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(() => (localStorage.getItem('geminiModel') as GeminiModel) || 'gemini-2.5-flash');


  // Feature toggles
  const [enableSfx, setEnableSfx] = useState(false);
  const [includeNarrator, setIncludeNarrator] = useState(true);
  const [useElevenLabsForSpeech, setUseElevenLabsForSpeech] = useState(true);

  // ElevenLabs voices
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  // YouTube state
  const [youtubeClientId, setYoutubeClientId] = useState(() => localStorage.getItem('youtubeClientId') || '');
  const [saveYoutubeClientId, setSaveYoutubeClientId] = useState(() => localStorage.getItem('saveYoutubeClientId') === 'true');
  const [isYouTubeLoggedIn, setIsYouTubeLoggedIn] = useState(false);
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [youtubePlaylists, setYoutubePlaylists] = useState<YouTubePlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');

  // Image generation settings
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>(() =>
    (localStorage.getItem('imageAspectRatio') as ImageAspectRatio) || '16:9'
  );
  const [imageStylePreset, setImageStylePreset] = useState<ImageStylePreset>(() =>
    (localStorage.getItem('imageStylePreset') as ImageStylePreset) || 'anime'
  );
  const [customImageStyle, setCustomImageStyle] = useState(() =>
    localStorage.getItem('customImageStyle') || ''
  );
  const [enableDialogueImages, setEnableDialogueImages] = useState(() =>
    localStorage.getItem('enableDialogueImages') === 'true'
  );
  const [imageModel, setImageModel] = useState<ImageModel>(() =>
    (localStorage.getItem('imageModel') as ImageModel) || 'gemini-2.0-flash-exp'
  );
  const [imageProvider, setImageProvider] = useState<ImageProvider>(() =>
    (localStorage.getItem('imageProvider') as ImageProvider) || 'gemini'
  );

  // Dialogue visual generation settings
  const [dialogueVisualMode, setDialogueVisualMode] = useState<DialogueVisualMode>(() =>
    (localStorage.getItem('dialogueVisualMode') as DialogueVisualMode) || 'compose'
  );
  const [veoModel, setVeoModel] = useState<VeoModel>(() =>
    (localStorage.getItem('veoModel') as VeoModel) || 'veo-3.1-generate-preview'
  );
  const [veoResolution, setVeoResolution] = useState<VideoResolution>(() =>
    (localStorage.getItem('veoResolution') as VideoResolution) || '720p'
  );
  const [veoDuration, setVeoDuration] = useState<VideoDuration>(() =>
    parseInt(localStorage.getItem('veoDuration') || '8') as VideoDuration
  );

  // Persist API keys

  useEffect(() => {
    if (saveGeminiKey && geminiApiKey) {
      localStorage.setItem('saveGeminiKey', 'true');
      localStorage.setItem('geminiApiKey', geminiApiKey);
    } else {
      localStorage.removeItem('saveGeminiKey');
      localStorage.removeItem('geminiApiKey');
    }
  }, [saveGeminiKey, geminiApiKey]);

  useEffect(() => {
    if (saveElevenLabsKey && elevenLabsApiKey) {
      localStorage.setItem('saveElevenLabsKey', 'true');
      localStorage.setItem('elevenLabsApiKey', elevenLabsApiKey);
    } else {
      localStorage.removeItem('saveElevenLabsKey');
      localStorage.removeItem('elevenLabsApiKey');
    }
  }, [saveElevenLabsKey, elevenLabsApiKey]);



  useEffect(() => {
    if (saveYoutubeClientId && youtubeClientId) {
      localStorage.setItem('saveYoutubeClientId', 'true');
      localStorage.setItem('youtubeClientId', youtubeClientId);
    } else {
      localStorage.removeItem('saveYoutubeClientId');
      localStorage.removeItem('youtubeClientId');
    }
  }, [saveYoutubeClientId, youtubeClientId]);

  // Save provider/model selections
  useEffect(() => {
    localStorage.setItem('llmProvider', llmProvider);
    localStorage.setItem('ttsProvider', ttsProvider);
    localStorage.setItem('geminiModel', geminiModel);
  }, [llmProvider, ttsProvider, geminiModel]);

  // Save image settings
  useEffect(() => {
    localStorage.setItem('imageAspectRatio', imageAspectRatio);
    localStorage.setItem('imageStylePreset', imageStylePreset);
    localStorage.setItem('customImageStyle', customImageStyle);
    localStorage.setItem('enableDialogueImages', enableDialogueImages ? 'true' : 'false');
    localStorage.setItem('imageModel', imageModel);
    localStorage.setItem('imageProvider', imageProvider);
  }, [imageAspectRatio, imageStylePreset, customImageStyle, enableDialogueImages, imageModel, imageProvider]);

  // Save dialogue visual mode settings
  useEffect(() => {
    localStorage.setItem('dialogueVisualMode', dialogueVisualMode);
    localStorage.setItem('veoModel', veoModel);
    localStorage.setItem('veoResolution', veoResolution);
    localStorage.setItem('veoDuration', veoDuration.toString());
  }, [dialogueVisualMode, veoModel, veoResolution, veoDuration]);

  // Check YouTube auth on mount
  useEffect(() => {
    setIsYouTubeLoggedIn(isYouTubeAuthenticated());
  }, []);

  // Load playlists when channel changes
  useEffect(() => {
    if (!selectedChannelId || !isYouTubeLoggedIn) {
      setYoutubePlaylists([]);
      return;
    }

    const loadPlaylistsAsync = async () => {
      const token = getYouTubeAccessToken();
      if (!token) return;

      setIsLoadingYouTube(true);
      try {
        const playlists = await listPlaylists(token, selectedChannelId);
        setYoutubePlaylists(playlists);
        setSelectedPlaylistId('');
      } catch (e) {
        console.error('Failed to load playlists:', e);
      } finally {
        setIsLoadingYouTube(false);
      }
    };

    loadPlaylistsAsync();
  }, [selectedChannelId, isYouTubeLoggedIn]);

  // Fetch ElevenLabs voices
  const handleFetchVoices = async () => {
    if (!elevenLabsApiKey) return;
    setIsLoadingVoices(true);
    try {
      const voices = await fetchElevenLabsVoices(elevenLabsApiKey);
      setElevenLabsVoices(voices);
    } catch (e: any) {
      console.error('Failed to fetch voices:', e);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // YouTube login/logout
  const handleYouTubeLogin = async () => {
    if (!youtubeClientId) {
      alert('Please set a YouTube OAuth Client ID first');
      return;
    }
    setIsLoadingYouTube(true);
    try {
      const token = await initiateYouTubeAuth(youtubeClientId);
      setIsYouTubeLoggedIn(true);
      const channels = await listChannels(token);
      setYoutubeChannels(channels);
      if (channels.length > 0) {
        setSelectedChannelId(channels[0].id);
      }
    } catch (e: any) {
      console.error('YouTube login error:', e);
      alert('YouTube login failed: ' + e.message);
    } finally {
      setIsLoadingYouTube(false);
    }
  };

  const handleYouTubeLogout = () => {
    clearYouTubeAuth();
    setIsYouTubeLoggedIn(false);
    setYoutubeChannels([]);
    setSelectedChannelId('');
    setYoutubePlaylists([]);
    setSelectedPlaylistId('');
  };

  // Navigation handler
  const handleNavigate = (page: AppPage, jobId?: string) => {
    setCurrentPage(page);
    if (page === 'studio' && jobId) {
      setEditingJobId(jobId);
    } else {
      setEditingJobId(null);
    }
  };

  // Batch processing handlers
  const handleGenerateScript = async (job: BatchJob, onProgress?: (msg: string) => void): Promise<BatchJob> => {
    onProgress?.('Generating script...');
    const apiKey = geminiApiKey;
    const shouldIncludeSfx = enableSfx && !!elevenLabsApiKey;

    const result = await generateScriptFromStory(
      job.storyText, shouldIncludeSfx, includeNarrator,
      elevenLabsVoices, apiKey, geminiModel
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

    const updatedJob = {
      ...job,
      status: 'script_ready' as const,
      scriptData: {
        cast: finalCast,
        scenes: result.scenes,
        items: result.items,
        podcastInfo: result.podcastInfo,
      }
    };

    updateBatchJob(job.id, updatedJob);
    return updatedJob;
  };

  const handleGenerateFiles = async (job: BatchJob, onProgress?: (msg: string) => void): Promise<BatchJob> => {
    if (!job.scriptData) throw new Error('No script data');

    onProgress?.('Preparing to generate files...');

    updateBatchJob(job.id, { status: 'generating' });

    const ctx = getAudioContext();
    const items = job.scriptData.items;
    const cast = job.scriptData.cast;
    const podcastInfo = job.scriptData.podcastInfo;

    // Use podcast info from script generation if available
    const episodeTitle = podcastInfo?.episodeTitle || job.episodeTitle || 'New Episode';
    const podcastDescription = podcastInfo?.description || job.podcastDescription || job.storyText.slice(0, 500);
    const podcastTitle = podcastInfo?.podcastName || job.podcastTitle || 'Podcast';

    // Generate audio for each item and save to IndexedDB
    const audioBuffers: AudioBuffer[] = [];
    const updatedItems = [...items];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      onProgress?.(`Generating audio ${idx + 1}/${items.length}...`);
      if (item.type === 'speech' && item.text) {
        const castMember = item.character ? cast.find(c => c.name === item.character) : undefined;

        // Build TTS config
        const ttsConfig: TtsConfig = {
          geminiApiKey,
          elevenLabsApiKey,
        };

        // Determine provider based on character voiceType or default to gemini
        const providerId = castMember?.voiceType || 'gemini';

        // For ElevenLabs, use voice_id; for others, use voice name
        const voiceId = providerId === 'elevenlabs' && castMember?.elevenLabsVoiceId
          ? castMember.elevenLabsVoiceId
          : castMember?.voice || 'Puck';

        try {
          const result = await ttsRegistry.generateSpeech(
            providerId,
            {
              text: item.text,
              voiceId,
              voiceName: castMember?.voice,
              voicePrompt: castMember?.voicePrompt,
              expression: item.expression,
            },
            ttsConfig
          );

          // Decode based on format
          const buffer = result.format === 'pcm'
            ? await decodeRawPCM(result.audioBase64, ctx)
            : await decodeAudioFile(result.audioBase64, ctx);
          audioBuffers.push(buffer);

          // Save audio to IndexedDB
          const audioKey = generateItemAudioKey(job.id, item.id);
          await saveItemAudioBase64(audioKey, result.audioBase64);
          updatedItems[idx] = {
            ...item,
            audioKey,
            audioFormat: result.format === 'pcm' ? 'pcm' : 'mp3'
          };
        } catch (e) {
          console.error(`[Batch] Failed to generate speech for item ${idx}:`, e);
        }

        await new Promise(r => setTimeout(r, 300));
      } else if (item.type === 'sfx' && item.sfxDescription && elevenLabsApiKey) {
        const base64 = await generateElevenLabsSfx(item.sfxDescription, 4, elevenLabsApiKey);
        const buffer = await decodeAudioFile(base64, ctx);
        audioBuffers.push(buffer);

        // Save SFX audio
        const audioKey = generateItemAudioKey(job.id, item.id);
        await saveItemAudioBase64(audioKey, base64);
        updatedItems[idx] = { ...item, audioKey, audioFormat: 'mp3' };

        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (audioBuffers.length === 0) {
      throw new Error('No audio generated');
    }

    onProgress?.('Merging audio and converting format...');

    // Merge audio
    const mergedBuffer = await mergeAudioBuffers(audioBuffers);
    const wavBlob = bufferToWav(mergedBuffer);
    const mp3Blob = await bufferToMp3(mergedBuffer);

    onProgress?.('Generating cover art...');

    // Generate cover art
    let coverBase64: string | undefined;
    const coverPrompt = podcastInfo?.coverPrompt || `Based on story: ${job.storyText.slice(0, 300)}`;
    if (geminiApiKey) {
      try {
        coverBase64 = await generatePodcastCoverArt(coverPrompt, podcastTitle, geminiApiKey);
      } catch (e) {
        console.error('[Batch] Cover art error:', e);
      }
    } else {
      console.log('[Batch] No Gemini API key, skipping cover art');
    }

    // Create WebM video if cover exists
    let webmBlob: Blob | undefined;
    if (coverBase64) {
      onProgress?.('Creating video (WebM)...');
      webmBlob = await createWebmVideo(wavBlob, coverBase64, mergedBuffer.duration);
    }

    onProgress?.('Saving files...');

    // Save to IndexedDB
    const mp3Key = generateAudioKey(job.id, 'mp3');
    const webmKey = webmBlob ? generateAudioKey(job.id, 'webm') : undefined;
    const coverKey = coverBase64 ? `${job.id}_cover` : undefined;

    await saveAudioBlob(mp3Key, mp3Blob);
    if (webmBlob && webmKey) {
      await saveAudioBlob(webmKey, webmBlob);
    }
    // Save cover art to IndexedDB
    if (coverBase64 && coverKey) {
      await saveItemAudioBase64(coverKey, coverBase64);
    }

    const updatedJob: BatchJob = {
      ...job,
      status: 'files_ready' as const,
      // Save metadata from scriptData for YouTube upload
      podcastTitle: podcastTitle,
      episodeTitle: episodeTitle,
      podcastDescription: podcastDescription,
      // Update scriptData with items containing audioKey references
      scriptData: {
        ...job.scriptData!,
        items: updatedItems,
      },
      files: {
        mp3Key,
        webmKey,
        coverKey,
      }
    };

    updateBatchJob(job.id, updatedJob);
    return updatedJob;
  };

  const handleUploadToYouTube = async (job: BatchJob): Promise<BatchJob> => {
    if (!job.files?.webmKey) throw new Error('No WebM file');

    const token = getYouTubeAccessToken();
    if (!token) throw new Error('Not logged in to YouTube');

    updateBatchJob(job.id, { status: 'uploading' });

    const webmBlob = await loadAudioBlob(job.files.webmKey);
    if (!webmBlob) throw new Error('WebM file not found');

    const result = await uploadToYouTube(
      webmBlob,
      {
        title: job.episodeTitle || job.scriptData?.podcastInfo?.episodeTitle || job.podcastTitle || 'New Episode',
        description: `${job.podcastDescription || job.storyText.slice(0, 500)}\n\n${job.scriptData?.podcastInfo?.tags?.map(t => `#${t}`).join(' ') || ''}`,
        tags: job.scriptData?.podcastInfo?.tags || [],
        categoryId: '22',
        privacyStatus: 'private',
        madeForKids: false,
      },
      token
    );

    // Add to playlist if selected
    if (selectedPlaylistId && result.videoId) {
      try {
        await addVideoToPlaylist(result.videoId, selectedPlaylistId, token);
      } catch (e) {
        console.warn('Could not add to playlist:', e);
      }
    }

    const updatedJob = {
      ...job,
      status: 'uploaded' as const,
      youtubeVideoId: result.videoId,
      youtubeUrl: result.url,
      uploadedAt: Date.now(),
    };

    updateBatchJob(job.id, updatedJob);
    return updatedJob;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="text-blue-400" size={24} />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Voice Drama Studio
              </h1>
              <p className="text-xs text-zinc-500">Powered by ElevenLabs + Gemini</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 bg-zinc-900 rounded-lg p-1">
            <button
              onClick={() => handleNavigate('batch')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${currentPage === 'batch'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
            >
              <Layers size={16} /> Batch
            </button>
            <button
              onClick={() => handleNavigate('studio')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${currentPage === 'studio'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
            >
              <Edit3 size={16} /> Studio
            </button>
            <button
              onClick={() => handleNavigate('config')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${currentPage === 'config'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
            >
              <Settings2 size={16} /> Settings
            </button>
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {currentPage === 'batch' && (
          <BatchPage
            onNavigate={handleNavigate}
            geminiApiKey={geminiApiKey}
            elevenLabsApiKey={elevenLabsApiKey}
            isYouTubeLoggedIn={isYouTubeLoggedIn}
            geminiModel={geminiModel}
            onGenerateScript={handleGenerateScript}
            onGenerateFiles={handleGenerateFiles}
            onUploadToYouTube={handleUploadToYouTube}
          />
        )}

        {currentPage === 'studio' && (
          <StudioPage
            jobId={editingJobId}
            onNavigate={handleNavigate}
            geminiApiKey={geminiApiKey}
            elevenLabsApiKey={elevenLabsApiKey}
            elevenLabsVoices={elevenLabsVoices}
            llmProvider={llmProvider}
            ttsProvider={ttsProvider}
            geminiModel={geminiModel}
            enableSfx={enableSfx}
            includeNarrator={includeNarrator}
            useElevenLabsForSpeech={useElevenLabsForSpeech}
            isYouTubeLoggedIn={isYouTubeLoggedIn}
            selectedPlaylistId={selectedPlaylistId}
            youtubePlaylists={youtubePlaylists}
            // Image settings
            imageAspectRatio={imageAspectRatio}
            imageStylePreset={imageStylePreset}
            customImageStyle={customImageStyle}
            enableDialogueImages={enableDialogueImages}
            imageModel={imageModel}
            imageProvider={imageProvider}
            // Dialogue visual mode
            dialogueVisualMode={dialogueVisualMode}
          />
        )}

        {currentPage === 'config' && (
          <ConfigPage
            geminiApiKey={geminiApiKey}
            setGeminiApiKey={setGeminiApiKey}
            saveGeminiKey={saveGeminiKey}
            setSaveGeminiKey={setSaveGeminiKey}
            elevenLabsApiKey={elevenLabsApiKey}
            setElevenLabsApiKey={setElevenLabsApiKey}
            saveElevenLabsKey={saveElevenLabsKey}
            setSaveElevenLabsKey={setSaveElevenLabsKey}

            elevenLabsVoices={elevenLabsVoices}
            isLoadingVoices={isLoadingVoices}
            onFetchVoices={handleFetchVoices}
            llmProvider={llmProvider}
            setLlmProvider={setLlmProvider}
            ttsProvider={ttsProvider}
            setTtsProvider={setTtsProvider}
            geminiModel={geminiModel}
            setGeminiModel={setGeminiModel}

            enableSfx={enableSfx}
            setEnableSfx={setEnableSfx}
            includeNarrator={includeNarrator}
            setIncludeNarrator={setIncludeNarrator}
            useElevenLabsForSpeech={useElevenLabsForSpeech}
            setUseElevenLabsForSpeech={setUseElevenLabsForSpeech}
            youtubeClientId={youtubeClientId}
            setYoutubeClientId={setYoutubeClientId}
            saveYoutubeClientId={saveYoutubeClientId}
            setSaveYoutubeClientId={setSaveYoutubeClientId}
            isYouTubeLoggedIn={isYouTubeLoggedIn}
            isLoadingYouTube={isLoadingYouTube}
            onYouTubeLogin={handleYouTubeLogin}
            onYouTubeLogout={handleYouTubeLogout}
            youtubeChannels={youtubeChannels}
            selectedChannelId={selectedChannelId}
            setSelectedChannelId={setSelectedChannelId}
            youtubePlaylists={youtubePlaylists}
            selectedPlaylistId={selectedPlaylistId}
            setSelectedPlaylistId={setSelectedPlaylistId}
            // Image settings
            imageAspectRatio={imageAspectRatio}
            setImageAspectRatio={setImageAspectRatio}
            imageStylePreset={imageStylePreset}
            setImageStylePreset={setImageStylePreset}
            customImageStyle={customImageStyle}
            setCustomImageStyle={setCustomImageStyle}
            enableDialogueImages={enableDialogueImages}
            setEnableDialogueImages={setEnableDialogueImages}
            imageModel={imageModel}
            setImageModel={setImageModel}
            imageProvider={imageProvider}
            setImageProvider={setImageProvider}
            // Dialogue visual mode
            dialogueVisualMode={dialogueVisualMode}
            setDialogueVisualMode={setDialogueVisualMode}
            veoModel={veoModel}
            setVeoModel={setVeoModel}
            veoResolution={veoResolution}
            setVeoResolution={setVeoResolution}
            veoDuration={veoDuration}
            setVeoDuration={setVeoDuration}
          />
        )}

      </main>
    </div>
  );
}
