import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not defined in the environment." }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: 'Generate a picture of a banana'
    });

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "Successfully hit the gemini-2.5-flash-image model (Nano Banana 1)!",
      response: res
    });
  } catch (e: any) {
    return NextResponse.json({ 
      status: "ERROR", 
      message: e.message || "An error occurred",
      fullError: e
    }, { status: 500 });
  }
}
