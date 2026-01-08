
import { GoogleGenAI, Type } from "@google/genai";
import {
  ItemType, ScriptItem, CastMember, SceneDefinition, ElevenLabsVoice, GeneratedPodcastInfo,
  ImageAspectRatio, ImageStylePreset, IMAGE_STYLE_PRESETS
} from "../types";
import {

  getSfxInstructions,
  getNarratorInstructions,
  getLanguageInstructions,
  getScenesInstructions,
  buildCastInstructions,
  buildScriptInstructionsGemini,
  getSystemPromptIntro,
  getPodcastMetadataInstructions,
  // 影像 prompt 模板
  getCharacterImagePrompt,
  getSceneImagePrompt,
  getDialogueImagePrompt,
  getImageStyleSuffix,
} from "./promptTemplates";

// Helper to get or create Gemini client
// Priority: provided apiKey > environment variable
const getAI = (apiKey?: string): GoogleGenAI => {
  const key = apiKey || process.env.API_KEY || '';
  if (!key) {
    throw new Error("Gemini API Key is required. Please enter it in Settings or set API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey: key });
};

interface GeneratedScriptResponse {
  cast: CastMember[];
  scenes: { name: string; visualDescription: string; characterNames?: string[] }[];
  script: any[];
  podcastInfo?: {
    podcastName: string;
    author: string;
    episodeTitle: string;
    description: string;
    coverPrompt: string;
    tags?: string[];
  };
}

const ALL_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir",
  "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina",
  "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird",
  "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"
];

export const generateScriptFromStory = async (
  story: string,
  includeSfx: boolean = true,
  includeNarrator: boolean = true,
  elevenLabsVoices: ElevenLabsVoice[] = [],
  apiKey?: string,
  model: string = 'gemini-2.5-flash',
  enableDialogueImages: boolean = true
): Promise<{ cast: CastMember[], scenes: SceneDefinition[], items: ScriptItem[], podcastInfo: GeneratedPodcastInfo | null }> => {
  if (!story.trim()) return { cast: [], scenes: [], items: [], podcastInfo: null };
  const ai = getAI(apiKey);

  const sfxInstructions = getSfxInstructions(includeSfx);
  const narratorInstructions = getNarratorInstructions(includeNarrator, includeSfx);

  const prompt = `
    ${getSystemPromptIntro()}
    Convert the following story into a detailed radio drama script with a cast list, a list of scenes (locations), a sequence of cues, and podcast metadata.
    
    ${getLanguageInstructions()}

    **INSTRUCTIONS**:
    ${buildCastInstructions(ALL_VOICES.join(', '), elevenLabsVoices, narratorInstructions)}

    ${getScenesInstructions()}

    ${buildScriptInstructionsGemini(sfxInstructions)}

    ${getPodcastMetadataInstructions()}

    Story:
    "${story}"
  `;

  console.log("--- [Gemini] Generate Script Prompt ---");
  console.log(prompt);
  console.log("---------------------------------------");

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cast: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  voice: { type: Type.STRING, enum: ALL_VOICES },
                  description: { type: Type.STRING },
                  voicePrompt: { type: Type.STRING, description: "TTS accent/style prompt in English" },
                  elevenLabsVoiceId: { type: Type.STRING, description: "ElevenLabs voice ID if available" },
                },
                required: ["name", "voice", "voicePrompt"]
              }
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  visualDescription: { type: Type.STRING, description: "Detailed environment description" },
                  characterNames: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of characters present in this scene" }
                },
                required: ["name", "visualDescription"]
              }
            },
            script: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: enableDialogueImages ? {
                  type: { type: Type.STRING, enum: [ItemType.SPEECH, ItemType.SFX] },
                  location: { type: Type.STRING },
                  character: { type: Type.STRING },
                  text: { type: Type.STRING },
                  expression: { type: Type.STRING },
                  sfxDescription: { type: Type.STRING },
                  imagePrompt: {
                    type: Type.STRING,
                    description: "Visual scene description. Refer to the FIRST character in 'sceneCharacters' as 'Character A', the SECOND as 'Character B', and so on. Refer to the location as 'The Scene'. Do NOT use real character names or location names."
                  },
                  sceneCharacters: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Names of all characters present in this scene moment (excluding Narrator). ORDER MATTERS: The first name is Character A, second is Character B."
                  }
                } : {
                  type: { type: Type.STRING, enum: [ItemType.SPEECH, ItemType.SFX] },
                  location: { type: Type.STRING },
                  character: { type: Type.STRING },
                  text: { type: Type.STRING },
                  expression: { type: Type.STRING },
                  sfxDescription: { type: Type.STRING }
                },
                required: enableDialogueImages
                  ? ["type", "location", "imagePrompt", "sceneCharacters"]
                  : ["type", "location"],
              },
            },
            podcastInfo: {
              type: Type.OBJECT,
              properties: {
                podcastName: { type: Type.STRING, description: "Podcast series name" },
                author: { type: Type.STRING, description: "Author/creator name" },
                episodeTitle: { type: Type.STRING, description: "Episode title" },
                description: { type: Type.STRING, description: "Episode description" },
                coverPrompt: { type: Type.STRING, description: "AI image generation prompt for cover art" },
                tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tags for discoverability" },
              },
              required: ["podcastName", "author", "episodeTitle", "description", "coverPrompt"]
            }
          },
          required: ["cast", "scenes", "script", "podcastInfo"]
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response text from Gemini");

    const data = JSON.parse(jsonText) as GeneratedScriptResponse;

    // Process Cast - add default voiceType
    const cast: CastMember[] = (data.cast || []).map(c => ({
      ...c,
      voiceType: 'gemini' as const,
    }));

    // Process Scenes
    const scenes: SceneDefinition[] = (data.scenes || []).map(s => ({
      id: crypto.randomUUID(),
      name: s.name,
      visualDescription: s.visualDescription,
      characterNames: (s.characterNames || []).filter(name =>
        !['Narrator', '旁白', 'System', '系統'].includes(name)
      )
    }));

    // Process Script Items
    const items = data.script.map((item: any) => ({
      ...item,
      id: crypto.randomUUID(),
    }));

    // Process Podcast Info
    const podcastInfo: GeneratedPodcastInfo | null = data.podcastInfo ? {
      podcastName: data.podcastInfo.podcastName,
      author: data.podcastInfo.author,
      episodeTitle: data.podcastInfo.episodeTitle,
      description: data.podcastInfo.description,
      coverPrompt: data.podcastInfo.coverPrompt,
      tags: data.podcastInfo.tags,
    } : null;

    return { cast, scenes, items, podcastInfo };

  } catch (error) {
    console.error("Error generating script:", error);
    throw error;
  }
};


export const generateSpeech = async (
  text: string,
  voiceName: string = 'Puck',
  voicePrompt: string = '',
  expression: string = '',
  apiKey?: string
): Promise<string> => {
  const ai = getAI(apiKey);

  // Build prompt with Director's Notes for accent/style control
  let textPrompt = text;
  if (voicePrompt || expression) {
    const style = [voicePrompt, expression].filter(Boolean).join(', ');
    textPrompt = `### DIRECTOR'S NOTES\nStyle: ${style}\n\n### TRANSCRIPT\n${text}`;
  }

  console.log("--- [Gemini] Generate Speech Prompt ---");
  console.log(`Voice: ${voiceName}`);
  console.log(`Text: ${textPrompt}`);
  console.log("---------------------------------------");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: textPrompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};

/**
 * Generate image using Gemini 2.0 Flash experimental model
 * @param prompt - Description of the desired image
 * @param apiKey - Gemini API key
 * @returns Base64 encoded image data
 */
/**
 * Story generation preset types
 */
export type StoryPreset = 'jokes' | 'news' | 'horror' | 'heartwarming' | 'adventure' | 'custom';

export interface GeneratedStory {
  title: string;
  content: string;
}

/**
 * Generate multiple stories from a topic using Gemini
 * @param topic - The topic/theme for story generation
 * @param count - Number of stories to generate
 * @param preset - Story preset type
 * @param customStyle - Custom style instructions (used when preset is 'custom')
 * @param exampleReference - Optional example stories for style/format reference
 * @param apiKey - Gemini API key
 * @param model - Gemini model to use
 * @returns Array of generated stories
 */
export const generateStoriesFromTopic = async (
  topic: string,
  count: number = 10,
  preset: StoryPreset = 'jokes',
  customStyle: string = '',
  exampleReference: string = '',
  apiKey?: string,
  model: string = 'gemini-2.5-flash'
): Promise<GeneratedStory[]> => {
  const ai = getAI(apiKey);

  // Preset configurations with Chinese prompts
  const presetConfigs: Record<StoryPreset, { style: string; instructions: string }> = {
    jokes: {
      style: '幽默笑話',
      instructions: `
        - 每個故事都是一個完整的笑話，有鋪陳和笑點
        - 笑話要有對話，適合用廣播劇形式表演
        - 包含 2-4 個角色互動
        - 結尾要有意外的轉折或諧音梗
        - 故事長度約 100-200 字
      `
    },
    news: {
      style: '有畫面感的新聞故事',
      instructions: `
        - 將新聞事件改編成有場景、對話的故事
        - 必須有具體的人物、地點、時間
        - 強調事件經過，有戲劇張力
        - 適合社會奇聞、人情故事、逆轉結局
        - 故事長度約 200-400 字
      `
    },
    horror: {
      style: '恐怖驚悚',
      instructions: `
        - 營造恐怖氛圍，有懸疑感
        - 強調場景描述和音效暗示
        - 結尾要有驚嚇或反轉
        - 適合深夜廣播劇風格
        - 故事長度約 200-400 字
      `
    },
    heartwarming: {
      style: '溫馨感人',
      instructions: `
        - 情感真摯，能引起共鳴
        - 有完整的情節發展
        - 適合家庭、親情、友情主題
        - 結尾要有正能量或感動點
        - 故事長度約 200-400 字
      `
    },
    adventure: {
      style: '冒險奇幻',
      instructions: `
        - 充滿想像力和冒險元素
        - 有明確的主角和挑戰
        - 場景多變，適合音效設計
        - 故事長度約 200-400 字
      `
    },
    custom: {
      style: customStyle || '自訂風格',
      instructions: customStyle ? `依照以下風格要求：${customStyle}` : ''
    }
  };

  const config = presetConfigs[preset];

  // Build example reference section if provided
  const exampleSection = exampleReference.trim() ? `
    **範例參考**（請參考以下範例的風格、格式和語調來創作）：
    ---
    ${exampleReference.trim()}
    ---
    重要：生成的故事應該模仿上述範例的寫作風格和結構，但內容必須是全新的、不同的故事。
  ` : '';

  const prompt = `
    你是一個專業的故事創作者，專門為廣播劇節目創作內容。

    **任務**：根據主題「${topic}」生成 ${count} 個不同的故事。

    **風格**：${config.style}

    **要求**：
    ${config.instructions}
    ${exampleSection}

    **通用規則**：
    - 每個故事都必須獨立完整
    - 故事要有對話，適合用廣播劇表演
    - 使用繁體中文
    - 每個故事要有吸引人的標題
    - 故事內容要有場景描述，方便轉換成廣播劇腳本

    請生成 ${count} 個故事。
  `;

  console.log("--- [Gemini] Generate Stories From Topic ---");
  console.log(`Topic: ${topic}, Count: ${count}, Preset: ${preset}`);
  console.log("-------------------------------------------");

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "故事標題" },
                  content: { type: Type.STRING, description: "故事完整內容" },
                },
                required: ["title", "content"]
              }
            }
          },
          required: ["stories"]
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response text from Gemini");

    const data = JSON.parse(jsonText) as { stories: GeneratedStory[] };
    console.log(`[Gemini] Generated ${data.stories.length} stories`);

    return data.stories;

  } catch (error) {
    console.error("Error generating stories:", error);
    throw error;
  }
};

/**
 * Generate image using Gemini's image generation model
 * @param prompt - Description of the desired image
 * @param aspectRatio - Output aspect ratio (default: '1:1')
 * @param apiKey - Gemini API key
 * @returns Base64 encoded image data
 */
export const generateImage = async (
  prompt: string,
  aspectRatio: ImageAspectRatio = '1:1',
  model: string = 'gemini-2.0-flash-exp',
  apiKey?: string
): Promise<string> => {
  const key = apiKey || process.env.API_KEY || '';
  if (!key) {
    throw new Error("Gemini API Key is required for image generation.");
  }

  console.log("--- [Gemini] Generate Image ---");
  console.log("Prompt:", prompt);
  console.log("Aspect Ratio:", aspectRatio);
  console.log("Model:", model);
  console.log("-------------------------------");

  try {
    // 根據模型選擇不同的 API 端點與格式
    let url = '';
    let body = {};

    if (model.includes('imagen')) {
      // Imagen 3.0 使用 :predict 端點
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`;
      body = {
        instances: [
          { prompt: prompt }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio || '1:1'
        }
      };
    } else {
      // Gemini 2.0 / 2.5 / 3.0 使用 :generateContent 端點
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const generationConfig: any = {
        responseModalities: ["IMAGE"],
      };

      // Support imageConfig for aspect ratio (Gemini 2.5+, 3.0+)
      if (aspectRatio) {
        generationConfig.imageConfig = {
          aspectRatio: aspectRatio
        };
      }

      body = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: generationConfig
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Gemini] Image generation error:", errorText);
      throw new Error(`Failed to generate image: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Parse response based on model
    if (model.includes('imagen')) {
      // Imagen Response: { predictions: [ { bytesBase64Encoded: "..." } ] }
      const base64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (!base64) throw new Error('No image generated (Imagen).');
      console.log("[Gemini] Imagen generated successfully.");
      return base64;
    } else {
      // Gemini Response
      const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (!imagePart?.inlineData?.data) {
        throw new Error('No image generated (Gemini).');
      }
      console.log("[Gemini] Gemini generated successfully.");
      return imagePart.inlineData.data;
    }
  } catch (error) {
    console.error("[Gemini] Image generation error:", error);
    throw error;
  }
};


/**
 * Generate character portrait image
 */
export const generateCharacterImage = async (
  character: CastMember,
  stylePreset: ImageStylePreset,
  customStyle: string,
  aspectRatio: ImageAspectRatio,
  imageModel: string,
  apiKey?: string
): Promise<string> => {
  const styleSuffix = getImageStyleSuffix(stylePreset, customStyle);
  const prompt = getCharacterImagePrompt(character, styleSuffix);

  console.log("[Gemini] Generating character image for:", character.name);
  return generateImage(prompt, aspectRatio, imageModel, apiKey);
};

/**
 * Generate scene background image
 */
export const generateSceneImage = async (
  scene: SceneDefinition,
  stylePreset: ImageStylePreset,
  customStyle: string,
  aspectRatio: ImageAspectRatio,
  imageModel: string,
  apiKey?: string
): Promise<string> => {
  const styleSuffix = getImageStyleSuffix(stylePreset, customStyle);
  const prompt = getSceneImagePrompt(scene, styleSuffix);

  console.log("[Gemini] Generating scene image for:", scene.name);
  return generateImage(prompt, aspectRatio, imageModel, apiKey);
};

/**
 * Generate dialogue/script item image (combines character + scene + action)
 */
export const generateDialogueImageForItem = async (
  item: ScriptItem,
  scene: SceneDefinition | null,
  cast: CastMember[],
  stylePreset: ImageStylePreset,
  customStyle: string,
  aspectRatio: ImageAspectRatio,
  imageModel: string,
  apiKey?: string
): Promise<string> => {
  const styleSuffix = getImageStyleSuffix(stylePreset, customStyle);
  const prompt = getDialogueImagePrompt(item, scene, cast, styleSuffix);

  console.log("[Gemini] Generating dialogue image for item:", item.id);
  return generateImage(prompt, aspectRatio, imageModel, apiKey);
};

/**
 * Generate a detailed image prompt from an uploaded image using Gemini Vision
 */
export const generateImageDescription = async (
  imageBase64: string,
  apiKey?: string
): Promise<string> => {
  const ai = getAI(apiKey);

  const prompt = `
    Analyze this image and provide a highly detailed, descriptive prompt that could be used to re-generate a similar image.
    Focus on:
    1. Physical appearance of characters (hair, clothes, age, features).
    2. Visual style (art style, lighting, color palette).
    3. Key elements and atmosphere.
    
    Output ONLY the prompt text, no intro/outro. Consice, comma-separated keywords and phrases preferred.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: imageBase64 } }
        ]
      }]
    });

    const text = response.text;
    if (!text) return "";

    console.log("[Gemini] Generated image description:", text);
    return text.trim();
  } catch (error) {
    console.error("Error generating image description:", error);
    // Fallback or rethrow? Let's return empty to let caller handle
    return "";
  }
};

// ============ 圖片合成功能 ============

export interface CharacterRef {
  name: string;
  imageBase64: string;
}

/**
 * Generate composite dialogue image using multiple reference images
 * Combines character images + scene image + action prompt
 * Uses Gemini's multi-image reference capability
 */
export const generateCompositeDialogueImage = async (
  actionPrompt: string,           // 動作/表情/對話描述
  characterRefs: CharacterRef[],  // 場景中的角色參考圖 (可多個)
  sceneImage: string | null,      // 場景背景圖 base64
  stylePreset: ImageStylePreset,
  customStyle: string,
  aspectRatio: ImageAspectRatio,
  model: string = 'gemini-2.5-flash-image',
  apiKey?: string
): Promise<string> => {
  const key = apiKey || process.env.API_KEY || '';
  if (!key) {
    throw new Error("Gemini API Key is required for image generation.");
  }

  const styleSuffix = getImageStyleSuffix(stylePreset, customStyle);

  // Build parts array with text prompt and reference images
  const parts: any[] = [];

  // Build the text prompt based on available references
  let textPrompt = '';

  if (characterRefs.length > 0 || sceneImage) {
    textPrompt = `Generate a dialogue scene image based on the following:\n\n`;

    // Add character reference instructions
    if (characterRefs.length > 0) {
      textPrompt += `CHARACTER REFERENCES:\n`;
      characterRefs.forEach((ref, idx) => {
        textPrompt += `- Image ${idx + 1}: Reference for character "${ref.name}" - use this character's appearance EXACTLY\n`;
      });
      textPrompt += '\n';
    }

    // Add scene reference instruction
    if (sceneImage) {
      const sceneIdx = characterRefs.length + 1;
      textPrompt += `SCENE BACKGROUND:\n`;
      textPrompt += `- Image ${sceneIdx}: Use this as the background/setting for the scene\n\n`;
    }

    textPrompt += `ACTION/SCENE DESCRIPTION:\n${actionPrompt}\n\n`;
    textPrompt += `STYLE: ${styleSuffix}\n\n`;
    textPrompt += `IMPORTANT INSTRUCTIONS:\n`;
    textPrompt += `- Maintain exact character appearances from reference images\n`;
    textPrompt += `- Blend characters naturally into the scene\n`;
    textPrompt += `- Match the visual style consistently across the image\n`;
    textPrompt += `- The generated image should be a single cohesive scene depicting the action described\n`;
    textPrompt += `- DO NOT render any text, dialogue, speech bubbles, or captions in the image`;
  } else {
    // No reference images, pure text generation
    textPrompt = `${actionPrompt}\n\nStyle: ${styleSuffix}`;
  }

  parts.push({ text: textPrompt });

  // Add character reference images
  for (const ref of characterRefs) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: ref.imageBase64
      }
    });
  }

  // Add scene reference image
  if (sceneImage) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: sceneImage
      }
    });
  }

  console.log("--- [Gemini] Generate Composite Image ---");
  console.log("Character refs:", characterRefs.length);
  console.log("Scene ref:", sceneImage ? "yes" : "no");
  console.log("Action prompt:", actionPrompt);
  console.log("Model:", model);
  console.log("-----------------------------------------");

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const generationConfig: any = {
      responseModalities: ["IMAGE"],
    };

    if (aspectRatio) {
      generationConfig.imageConfig = {
        aspectRatio: aspectRatio
      };
    }

    const body = {
      contents: [{
        parts: parts
      }],
      generationConfig: generationConfig
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Gemini] Composite image generation error:", errorText);
      throw new Error(`Failed to generate composite image: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No composite image generated.');
    }

    console.log("[Gemini] Composite image generated successfully.");
    return imagePart.inlineData.data;
  } catch (error) {
    console.error("[Gemini] Composite image generation error:", error);
    throw error;
  }
};
