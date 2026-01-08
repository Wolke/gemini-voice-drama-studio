/**
 * Shared prompt templates for script generation
 * Used by Gemini services
 */

import { ElevenLabsVoice } from '../types';

/**
 * Get SFX instructions based on whether sound effects are enabled
 */
export const getSfxInstructions = (includeSfx: boolean): string => {
  if (includeSfx) {
    return `
       - For 'sfx' (Sound Effects):
         - 'sfxDescription': A short, descriptive prompt for a sound effect generator.
    `;
  }
  return `
       - **IMPORTANT**: DO NOT generate any items with type 'sfx'. The user has disabled sound effects.
    `;
};

/**
 * Get narrator instructions based on settings
 */
export const getNarratorInstructions = (includeNarrator: boolean, includeSfx: boolean): string => {
  if (includeNarrator) {
    return `
       - **Narrator**: You MUST include a character named 'Narrator' (or '旁白' if the story is in Chinese) in the cast and script. 
         - Use the Narrator to describe the setting, actions, transitions, and atmosphere that cannot be conveyed by dialogue alone.
         - Ensure the Narrator appears frequently to guide the listener.
    `;
  }
  return `
       - **Narrator**: DO NOT include a Narrator or System character. 
         - The story must be conveyed ENTIRELY through character dialogue${includeSfx ? ' and sound effects' : ''}.
         - Adapt the dialogue so characters describe actions if necessary.
    `;
};

/**
 * Get voice prompt examples for TTS accent/style guidance
 */
export const getVoicePromptExamples = (): string => {
  return `
     **For English stories:**
     - "American English speaker, energetic and youthful"
     - "British English speaker, warm and gentle"
     - "Australian English speaker, friendly and casual"
     
     **For Chinese stories:**
     - "Native Taiwanese Mandarin speaker, soft and friendly"
     - "Native Beijing Mandarin speaker, formal and authoritative"
     - "Shandong accent Mandarin speaker, earnest and straightforward"
     - "Sichuan accent Mandarin speaker, lively and humorous"
     - "Hong Kong Cantonese accent speaking Mandarin, businesslike"
     
     **IMPORTANT: Match voice prompts to the story language!**
     - English story → Use English speaker accents
     - Chinese story → Use Chinese speaker accents
     
     **For Chinese stories with regional characters**: 
     - **Character-specific accent takes priority**: If the story explicitly mentions a character's regional origin or accent (e.g., 山東伯伯, 四川人, 外省籍), use that specific regional accent (e.g., "Shandong accent Mandarin speaker", NOT "Taiwanese Mandarin with Shandong accent").
     - **Do NOT mix accents illogically**: A person is either a Shandong accent speaker OR a Taiwanese Mandarin speaker, not both at the same time.
     - **Default accent for Chinese stories**:
       - Traditional Chinese (繁體字) stories → "Native Taiwanese Mandarin speaker"
       - Simplified Chinese (简体字) stories → "Native Beijing Mandarin speaker"`;
};

/**
 * Get language instructions for multilingual support
 */
export const getLanguageInstructions = (): string => {
  return `**CRITICAL LANGUAGE INSTRUCTION**: 
- **FIRST**: Detect the language of the input story (English, Chinese, Japanese, etc.)
- **The 'text' (dialogue) field MUST be in the SAME LANGUAGE as the input story.**
  - If the story is in English → ALL dialogue MUST be in English
  - If the story is in Chinese → ALL dialogue MUST be in Chinese
  - NEVER translate the story content to a different language
- The 'expression' and 'visualDescription' (for scenes) fields MUST ALWAYS be in ENGLISH.
- The 'voicePrompt' field should match the story language:
  - English stories → English accents (e.g., "American English speaker, cheerful")
  - Chinese stories → Chinese accents (e.g., "Native Taiwanese Mandarin speaker, cheerful")`;
};

/**
 * Get scenes instructions
 */
export const getScenesInstructions = (): string => {
  return `2. **Scenes**: Identify the key locations/environments in the story.
   - Provide a 'name' (e.g., "Living Room", "Forest at Night").
   - Provide a 'visualDescription' (ENGLISH): Detailed atmospheric description.
   - Provide 'characterNames': A list of character names (string[]) that are primarily present in this scene (based on the story).`;
};

/**
 * Get ElevenLabs voices instructions if available
 */
export const getElevenLabsVoicesInstructions = (voices: ElevenLabsVoice[]): string => {
  if (voices.length === 0) return '';

  return `
   - **IMPORTANT**: You have access to the following ElevenLabs voices. Pick the most suitable voice for each character based on the voice characteristics:
${voices.slice(0, 20).map(v => `     - "${v.name}" (ID: ${v.voice_id})${v.labels ? ` - ${Object.entries(v.labels).map(([k, val]) => `${k}: ${val}`).join(', ')}` : ''}`).join('\n')}
   - Set 'elevenLabsVoiceId' to the voice ID that best matches the character.
   `;
};

/**
 * Get the complete system prompt intro
 */
export const getSystemPromptIntro = (): string => {
  return `You are an expert radio drama scriptwriter and director. 
Convert stories into detailed radio drama scripts with a cast list, a list of scenes (locations), and a sequence of cues.`;
};

/**
 * Build cast instructions with voice list
 */
export const buildCastInstructions = (
  voiceListStr: string,
  elevenLabsVoices: ElevenLabsVoice[],
  narratorInstructions: string
): string => {
  return `1. **Cast**: Identify all characters. 
   - Assign a voice from the voice list: ${voiceListStr}.
   - **IMPORTANT**: Assign DIFFERENT voices to different characters! Do NOT give everyone the same voice.
     - Pick voices that match each character's personality, age, and gender.
     - Example: A gruff old man might get 'onyx', a young woman might get 'nova', a child might get 'shimmer'.
   - Provide a brief 'description' of the character's PHYSICAL APPEARANCE (visual traits, clothing, age, style). Do NOT describe their actions or plot role (e.g. "a brave warrior in shining armor" NOT "trying to save the princess").
   - Provide a 'voicePrompt' (ENGLISH): A TTS prompt describing the character's accent, speech style, and tone. Examples:${getVoicePromptExamples()}
   ${getElevenLabsVoicesInstructions(elevenLabsVoices)}
   ${narratorInstructions}`;
};

/**
 * Build script instructions for Gemini (schema enforces type)
 */
export const buildScriptInstructionsGemini = (sfxInstructions: string): string => {
  return `3. **Script**: A list of cues.
   - 'location': The name of the scene where this cue takes place (MUST match a name from the Scenes list).
   - For 'speech':
     - 'character': Name from the cast list.
     - 'text': The dialogue (IN THE STORY'S LANGUAGE).
     - 'expression': A direction for HOW it should be spoken (IN ENGLISH).
   ${sfxInstructions}

Return a JSON object with keys "cast", "scenes", "script", and "podcastInfo".`;
};

/**
 * Get Podcast metadata generation instructions
 * Note: podcastName and author are saved by user, not AI generated
 */
export const getPodcastMetadataInstructions = (): string => {
  return `4. **Podcast Info**: Generate episode-specific metadata for podcast publishing.
   - 'episodeTitle': Title for this episode (IN THE STORY'S LANGUAGE, e.g., "第一集：故事開始", "Episode 1: The Beginning")
   - 'description': A compelling 2-3 sentence description of the episode content for podcast platforms (IN THE STORY'S LANGUAGE)
   - 'coverPrompt': A detailed ENGLISH prompt for AI image generation to create podcast cover art. Include:
     * Visual style (e.g., "modern illustration", "vintage radio aesthetic", "cinematic", "anime style")
     * Key visual elements from the story (objects, atmosphere, mood)
     * Color palette suggestions
     * Typography style for the title
     Example: "A vintage radio microphone glowing in a dark studio, surrounded by ethereal blue mist and floating musical notes. Art deco style with gold and deep purple tones. Modern clean typography for the title."
   - 'tags': Array of 3-5 relevant tags for discoverability (IN ENGLISH, e.g., ["drama", "mystery", "chinese", "audio-fiction"])`;
};

// ============ Image Generation Prompt Templates ============

/**
 * Generate character portrait prompt
 */
export const getCharacterImagePrompt = (
  character: { name: string; description?: string; imagePrompt?: string },
  styleSuffix: string
): string => {
  const baseDescription = character.imagePrompt || character.description || '';
  const characterPrompt = baseDescription
    ? `Character portrait of ${baseDescription}`
    : `Character portrait of a person named ${character.name}`;

  return `${characterPrompt}. ${styleSuffix}. High quality, detailed, character concept art, no text, no letters, clean background.`;
};

/**
 * Generate scene background prompt
 */
export const getSceneImagePrompt = (
  scene: { name: string; visualDescription: string; imagePrompt?: string; characterNames?: string[] },
  styleSuffix: string
): string => {
  const sceneDescription = scene.imagePrompt || scene.visualDescription;
  const charactersContext = scene.characterNames && scene.characterNames.length > 0
    ? `Characters present in scene: ${scene.characterNames.join(', ')}.`
    : 'No characters visible.';

  return `Environment scene: ${sceneDescription}. Location context: ${scene.name}. ${charactersContext} ${styleSuffix}. Atmospheric, cinematic composition, suitable for a visual novel background, clean background, no text.`;
};

/**
 * Generate dialogue image prompt (combines character + scene + current action)
 */
export const getDialogueImagePrompt = (
  item: {
    id?: string;
    character?: string;
    text?: string;
    expression?: string;
    imagePrompt?: string;
    sfxDescription?: string;
  },
  scene: { name: string; visualDescription: string } | null,
  characters: { name: string; description?: string; imagePrompt?: string }[],
  styleSuffix: string
): string => {
  // Use custom imagePrompt if available
  if (item.imagePrompt) {
    const sceneContext = scene ? `Background: ${scene.visualDescription}. ` : '';
    return `${sceneContext}${item.imagePrompt}. ${styleSuffix}. High quality, cinematic composition.`;
  }

  // SFX item
  if (item.sfxDescription) {
    const sceneContext = scene ? `In ${scene.name}, ${scene.visualDescription}. ` : '';
    return `${sceneContext}Visual representation of: ${item.sfxDescription}. ${styleSuffix}. Atmospheric, dynamic composition.`;
  }

  // Dialogue item: combine scene + character + expression
  const sceneContext = scene
    ? `Setting: ${scene.name}. ${scene.visualDescription}. `
    : '';

  // Find the speaking character
  const speakingCharacter = item.character
    ? characters.find(c => c.name === item.character)
    : null;

  const characterContext = speakingCharacter
    ? `Character: ${speakingCharacter.imagePrompt || speakingCharacter.description || speakingCharacter.name}. `
    : '';

  const expressionContext = item.expression
    ? `Expression/Action: ${item.expression}. `
    : '';

  // Simplify dialogue as scene description hint
  const dialogueHint = item.text && item.text.length < 100
    ? `Scene shows someone speaking: "${item.text.slice(0, 50)}..." `
    : '';

  console.log(`[PromptTemplate] Building Dialogue Image Prompt for Item ID: ${item.id || 'unknown'}`);
  console.log(`  - Scene: ${scene ? scene.name : 'None'}`);
  console.log(`  - Character: ${speakingCharacter ? speakingCharacter.name : 'None'}`);
  if (speakingCharacter) {
    console.log(`    -> Has Custom Image Prompt? ${!!speakingCharacter.imagePrompt}`);
    console.log(`    -> Has Description? ${!!speakingCharacter.description}`);
  }
  console.log(`  - Expression: ${item.expression || 'None'}`);
  console.log(`  - Resulting Prompt: ${sceneContext}${characterContext}${expressionContext}${dialogueHint}${styleSuffix}...`);

  return `${sceneContext}${characterContext}${expressionContext}${dialogueHint}${styleSuffix}. High quality, cinematic composition, visual novel style.`;
};

/**
 * Get image style suffix prompt
 */
export const getImageStyleSuffix = (
  preset: string,
  customStyle: string
): string => {
  if (preset === 'custom' && customStyle) {
    return customStyle;
  }

  const presetConfig = [
    { value: 'anime', promptSuffix: 'anime style, vibrant colors, detailed' },
    { value: 'realistic', promptSuffix: 'photorealistic, highly detailed, professional photography' },
    { value: 'watercolor', promptSuffix: 'watercolor painting style, soft colors, artistic' },
    { value: 'cartoon', promptSuffix: 'cartoon style, bold outlines, colorful' },
    { value: 'cinematic', promptSuffix: 'cinematic lighting, movie still, dramatic' },
  ].find(p => p.value === preset);

  return presetConfig?.promptSuffix || 'high quality, detailed';
};
