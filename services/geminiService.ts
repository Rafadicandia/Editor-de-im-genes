
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

// Helper to convert File to a base64 string (data URL)
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export interface EditImageResult {
    imageUrl: string | null;
    text: string | null;
}

export const editImage = async (imageFile: File, prompt: string): Promise<EditImageResult> => {
    if (!process.env.API_KEY) {
        throw new Error("La clave de API de Gemini no está configurada. Asegúrate de que la variable de entorno API_KEY esté definida.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const base64DataUrl = await fileToBase64(imageFile);
    // Extract the raw base64 data part from the data URL
    const base64Data = base64DataUrl.split(',')[1];
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: imageFile.type,
                    },
                },
                {
                    text: prompt,
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    let resultImageUrl: string | null = null;
    let resultText: string | null = null;

    if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                resultText = part.text;
            } else if (part.inlineData) {
                const imageData = part.inlineData.data;
                const imageMimeType = part.inlineData.mimeType;
                resultImageUrl = `data:${imageMimeType};base64,${imageData}`;
            }
        }
    }

    if (!resultImageUrl && !resultText) {
        throw new Error("La API no devolvió una imagen o texto. La respuesta podría estar bloqueada.");
    }

    return { imageUrl: resultImageUrl, text: resultText };
};
