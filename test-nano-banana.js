const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log("----- ERROR -----");
  console.error("GEMINI_API_KEY is not defined in the environment.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log("Testing Nano Banana (Gemini Image Generation)...");
  try {
    // We will use the model string 'nano-banana'
    const res = await ai.models.generateImages({
      model: 'nano-banana',
      prompt: 'A test image of a banana',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
      }
    });

    console.log("----- SUCCESS -----");
    if (res.generatedImages && res.generatedImages.length > 0) {
      console.log("Image successfully generated! Base64 length:", res.generatedImages[0].image.imageBytes.length);
    } else {
      console.log(JSON.stringify(res, null, 2));
    }
  } catch (e) {
    console.log("----- ERROR -----");
    console.error(e.message || e);
  }
}

run();
