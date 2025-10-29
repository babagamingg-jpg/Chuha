import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * A utility function to retry an async function with exponential backoff.
 * @param asyncFn The async function to execute.
 * @param maxRetries The maximum number of retries.
 * @param initialDelay The initial delay in milliseconds.
 * @returns The result of the async function.
 */
const withRetry = async <T>(
  asyncFn: () => Promise<T>, 
  maxRetries = 3, 
  initialDelay = 2000
): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await asyncFn();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error(`API call failed after ${maxRetries} attempts.`, error);
        throw error; // Rethrow the final error
      }
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  // This line should be unreachable, but it satisfies TypeScript's need for a return path.
  throw new Error("Retry logic failed unexpectedly.");
};


export const splitTextIntoSentences = async (text: string): Promise<string[]> => {
    try {
        const prompt = `You are an expert in English pedagogy for Indian students. Your task is to split the following English text into a list of complete, meaningful statements for a presentation.

**Rules:**
1.  **Pedagogical Units:** Your primary goal is to create short, digestible units of information perfect for a Class 12 student. Each unit will be on its own slide.
2.  **Semantic Completeness:** Each item in the output array must convey a complete idea. Do not split a sentence if it leaves a clause awkwardly dependent on the next slide.
3.  **Natural Breaks:** Split at natural punctuation (periods, semicolons), but also identify logical breaks within long, complex sentences common in literature.
4.  **Prose vs. Poetry:** For prose, focus on complete thoughts. For poetry, respect line breaks and stanzas as natural separators, but you may group short lines if they form a single thought.
5.  **Avoid Trivial Splits:** Do not create single-word items unless it is a poetically significant word meant to be emphasized alone.
6.  **Clean Output:** Ensure no empty strings are in the final array.

**Example:**
Input Text: "The woods are lovely, dark and deep, but I have promises to keep, and miles to go before I sleep."
Correct Output Array:
[
  "The woods are lovely, dark and deep,",
  "but I have promises to keep,",
  "and miles to go before I sleep."
]

**Text to Split:**
"${text}"`;

        // FIX: Specify the generic type for withRetry to ensure `response` is correctly typed.
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using a more powerful model for better pedagogical splitting
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    description: "A list of sentences or clauses from the input text, split for pedagogical clarity.",
                    items: {
                        type: Type.STRING,
                        description: "A single, semantically complete statement or meaningful clause.",
                    },
                },
                temperature: 0.1, 
            },
        }));

        const jsonString = response.text.trim();
        const sentences = JSON.parse(jsonString);
        
        if (!Array.isArray(sentences) || !sentences.every(item => typeof item === 'string')) {
             throw new Error("API returned an invalid format for sentences.");
        }
        return sentences.filter(s => s.trim() !== '');

    } catch (error) {
        console.error("Error splitting text into sentences:", error);
        console.log("Falling back to simple newline/period splitting.");
        return text.split(/[\n.]+/).filter(line => line.trim().length > 2);
    }
};

export const translateText = async (text: string, context?: string): Promise<string> => {
  try {
    // FIX: Specify the generic type for withRetry to ensure `response` is correctly typed.
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a professional translator specializing in educational content for Indian students. Translate the following English literary text into clear, standard Hindi for a Class 12 student from the Bihar Board.
    
**Rules:**
1.  **Clarity Above All:** The translation must be clear, simple, and easy for a student to understand. Use standard vocabulary taught in schools.
2.  **Natural & Fluent:** The Hindi should sound natural, not like a literal, word-for-word translation.
3.  **Maintain Literary Tone:** If the original is poetic or formal, the translation should reflect that tone appropriately.
4.  **Crucial for Continuity:** Refer to the provided context from previous parts of the lesson. Your translation MUST maintain a consistent tone, vocabulary, and style established in the context.
5.  **Output:** Return only the translated Hindi text and nothing else.

**Context from previous parts of the lesson:**
"${context || 'No previous context provided.'}"

**English Text to Translate:**
"${text}"`,
      config: {
          temperature: 0.2,
      }
    }));
    return response.text.trim();
  } catch (error) {
    console.error("Error translating text:", error);
    return "अनुवाद में त्रुटि हुई।"; // Error in translation.
  }
};

export const generateExplanation = async (text: string, context?: string): Promise<string> => {
    try {
        const prompt = `You are an expert and engaging teacher for Class 12 Bihar Board students. Your task is to create a short, insightful narration script in simple Hindi for the following English literary text.

**Crucial Instruction:** Your goal is for a student to understand the English line completely just by listening to your Hindi narration. The narration must be direct, concise, and deeply explanatory, avoiding unnecessary introductory phrases.

**Rules:**
1.  **Direct & Concise:** Get straight to the point. Do NOT use phrases like "इस पंक्ति का मतलब है कि...", "यहाँ लेखक कह रहे हैं कि...", or "इसका अर्थ है...". The explanation should begin immediately with the core idea.
2.  **Embody the Meaning:** Your explanation should naturally incorporate the meaning of the English line without explicitly announcing that you are translating it. It should feel like a seamless clarification and contextualization.
3.  **Explain the 'Why':** Immediately follow up with the deeper context. Why did the author use these words? What feeling are they trying to create? What does it tell us about the story or characters?
4.  **Identify Literary Tools:** If there's a metaphor or simile, point it out simply as part of your explanation. For example, "...यह सिर्फ एक जंगल नहीं है, बल्कि एक प्रतीक है..."
5.  **Conversational Tone:** Keep the explanation to 2-3 powerful but conversational sentences. It should sound like a knowledgeable teacher making a direct, insightful point.
6.  **Clean Output:** Provide only the Hindi explanation. No greetings, no "Hello students," just the core explanation.

**Example:**
*   **English Text:** "The woods are lovely, dark and deep,"
*   **Old Explanation (to avoid):** "इस पंक्ति में कवि कहते हैं कि जंगल बहुत ही सुन्दर, घना और गहरा है। ..." (Starts with an unnecessary intro phrase).
*   **New, Strong Explanation (what you should do):** "जंगल बहुत सुन्दर, घना और गहरा है, लेकिन यह सिर्फ एक जंगल का वर्णन नहीं है। यह सुंदरता और शांति असल में जीवन के उन आकर्षणों का प्रतीक है जो हमें हमारी जिम्मेदारियों से दूर खींचते हैं।" (The forest is very lovely, dark, and deep, but this isn't just a description of a forest. This beauty and peace is actually a symbol of life's attractions that pull us away from our responsibilities.)

**Context from previous parts of the lesson (use this to ensure your explanation is continuous and builds upon what was taught):**
"${context || 'This is the beginning of the lesson.'}"

**English Text to Explain:**
"${text}"

**Your Hindi Explanation:**
`;
        const systemInstruction = `You are an expert and engaging teacher for Class 12 Bihar Board students. Your primary goal is to create a seamless, continuous lesson. When context from a previous part of the lesson is provided, you MUST use it to link the new explanation to what has already been taught. Your tone, terminology, and thematic focus must be consistent with the context.`;

        // FIX: Specify the generic type for withRetry to ensure `response` is correctly typed.
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using a more powerful model for better pedagogical explanations.
            contents: prompt,
            config: {
                systemInstruction: context ? systemInstruction : undefined,
                temperature: 0.5,
            }
        }));
        return response.text.trim();
    } catch (error) {
        console.error("Error generating explanation:", error);
        return "इस पंक्ति का स्पष्टीकरण उत्पन्न नहीं हो सका।"; // Explanation for this line could not be generated.
    }
};

export const generateImage = async (englishText: string, explanation: string, context?: string): Promise<string | null> => {
    try {
        const prompt = `Create a beautiful, evocative digital painting that visually represents the mood and content of this English literary text.
Style: Soft, slightly dreamy, and educational. Avoid overly cartoonish or photorealistic styles. Focus on mood and symbolism.
Aspect Ratio: 16:9 for a presentation slide.

**Critical Continuity:** Your image MUST be visually consistent with the Chapter Context provided below. If the context describes a particular art style, character, or setting, you must adhere to it to create a cohesive visual story.

Chapter Context: "${context || 'No additional context provided.'}"

Text to Visualize: "${englishText}"
Explanation of Text: "${explanation}"`;

        // FIX: Specify the generic type for withRetry to ensure `response` is correctly typed.
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        }));

        // FIX: Use optional chaining and nullish coalescing for safe access to potentially undefined properties.
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        return null;

    } catch (error) {
        console.error("Error generating image:", error);
        return null;
    }
};

export const generateSpeech = async (script: string): Promise<string | null> => {
    if (!script || !script.trim()) {
        return null;
    }
    try {
        // FIX: Specify the generic type for withRetry to ensure `response` is correctly typed.
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            // Prompt is simplified to only pass the script, improving reliability.
            contents: [{ parts: [{ text: script }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        // Using a pleasant, clear voice suitable for education.
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, 
                    },
                },
            },
        }));
        
        // Use optional chaining for safe access to potentially undefined properties.
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        return base64Audio ?? null;

    } catch (error) {
        console.error("Error generating speech:", error);
        return null;
    }
};