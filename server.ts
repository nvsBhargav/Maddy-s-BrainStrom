import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: "50mb" }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  app.post("/api/generate", async (req, res) => {
    const { prompt } = req.body || {};
    try {
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const textResponse = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an infinite spatial-knowledge-engine generator. Respond to the user's query by generating AI content in a specific JSON format. The format must contain:\n1. 'text': AI-generated explanatory text detailing the topic. Use markdown if necessary, but keep it brief, engaging, and impactful (2-3 short paragraphs). CRITICAL: You MUST wrap 2 to 4 key concepts or interesting terms in your text as markdown links using the exact format `[Search Term](Search Term)`, so users can click them to branch off and explore that topic further!\n2. 'asciiArt': A clean, creative, and evocative 8 to 12 line monochrome ASCII art diagram, schematic, or pictorial symbol representing the topic.\n3. 'prompts': An array of exactly 3 concise string items containing suggested follow-up questions or sub-topics.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              asciiArt: { type: Type.STRING },
              prompts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["text", "asciiArt", "prompts"],
          },
        },
      });

      let rawText = textResponse.text || "{}";
      rawText = rawText.replace(/```(json)?/gi, '').trim();
      const responseData = JSON.parse(rawText);
      res.json(responseData);
    } catch (error: any) {
      console.warn("Notice in /api/generate:", error.message || error);
      const isQuotaError = error?.status === 429 || error?.code === 429 || error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.message?.includes("Exhausted");
      
      // Fallback matter so canvas nodes always generate cleanly even if quota is exhausted
      const fallbackTopic = prompt || "Conceptual Knowledge";
      const fallbackText = `### ${fallbackTopic}\n\nThis domain encapsulates fundamental principles of **[${fallbackTopic}]( ${fallbackTopic} )**, exploring how core mechanics and structural frameworks interlock within complex spatial systems.\n\nKey observational research highlights how **[System Dynamics](System Dynamics)** and **[Emergent Patterns](System Patterns)** drive adaptive behavior across multi-layered networks.`;
      
      res.json({
        text: fallbackText,
        asciiArt: `+-----------------------+\n|  ${fallbackTopic.slice(0, 18).padEnd(18)}   |\n|  [SPATIAL KNOWLEDGE]  |\n+-----------------------+`,
        prompts: [
          `Principles of ${fallbackTopic}`,
          `Future Directions in ${fallbackTopic}`,
          `Cross-domain Applications`
        ],
        quotaNotice: isQuotaError ? "Gemini API quota exhausted - returned offline matter synthesis." : undefined
      });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, imageBase64 } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      let parts: any[] = [{ text: "Strictly black and white editorial style photography. Single subject. No text inside the image. No grid format, no multiple panels, just one single cohesive image. High-resolution, cinematic lighting. For abstract or scientific concepts (like physics or chemistry), do NOT depict people unless specifically requested. " + prompt }];
      if (imageBase64) {
        const match = imageBase64.match(/^data:(image\/[a-zA-Z]*);base64,([^"]*)$/);
        if (match && match.length === 3) {
          parts.unshift({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      const imageResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts },
        config: {
          imageConfig: { aspectRatio: "4:3" }
        } as any,
      });

      let base64EncodeString = "";
      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64EncodeString = part.inlineData.data;
          break;
        }
      }

      if (base64EncodeString) {
        res.json({ imageUrl: `data:image/jpeg;base64,${base64EncodeString}` });
      } else {
        res.json({ imageUrl: null, message: "No image data generated" });
      }
    } catch (error: any) {
      const isQuotaError = error?.status === 429 || error?.code === 429 || error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED");
      if (isQuotaError) {
        console.warn("Image generation quota unavailable for gemini-3.1-flash-lite-image. Gracefully falling back to visual ASCII diagram.");
        res.json({ imageUrl: null, quotaExceeded: true, message: "Image quota unavailable" });
      } else {
        console.warn("Notice generating image:", error.message || error);
        res.json({ imageUrl: null, error: error.message || "Failed to generate image" });
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
