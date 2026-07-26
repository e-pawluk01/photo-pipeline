import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not defined in the environment." }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const res = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: 'A test image of a banana',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
      }
    });

    if (res.generatedImages && res.generatedImages.length > 0) {
      return NextResponse.json({ 
        status: "SUCCESS", 
        message: "Image successfully generated!",
        base64Length: res.generatedImages[0].image?.imageBytes?.length || 0
      });
    } else {
      return NextResponse.json({ status: "SUCCESS_BUT_NO_IMAGE", response: res });
    }
  } catch (e: any) {
    return NextResponse.json({ 
      status: "ERROR", 
      message: e.message || "An error occurred",
      fullError: e
    }, { status: 500 });
  }
}
