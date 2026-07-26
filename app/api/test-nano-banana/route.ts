import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not defined in the environment." }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "Here are the available models",
      models: data.models?.map((m: any) => ({
        name: m.name,
        version: m.version,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods
      })) || data
    });
  } catch (e: any) {
    return NextResponse.json({ 
      status: "ERROR", 
      message: e.message || "An error occurred",
      fullError: e
    }, { status: 500 });
  }
}
