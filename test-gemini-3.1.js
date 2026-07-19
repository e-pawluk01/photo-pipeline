const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log("----- ERROR -----");
  console.error("GEMINI_API_KEY is not defined in the environment.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log("Testing gemini-3.1-flash-lite...");
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'say hello'
    });
    console.log("----- SUCCESS -----");
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("----- ERROR -----");
    console.error(e);
  }
}

run();
