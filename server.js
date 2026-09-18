import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));

app.post("/api/diagnose", async (req, res) => {
  try {
    const { imageBase64, mimeType, crop, language } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image received." });
    }

    const selectedLang = language === "te" ? "Telugu" : "English";

 const prompt = `You are an expert crop agronomist for KisanMitra AI.
Analyze this photo of a ${crop || "plant"} leaf.
Respond strictly in JSON format with the following keys:
{
  "problem": "Name of disease, pest, or deficiency (or Healthy)",
  "details": "A clear 1-2 sentence description of symptoms in ${selectedLang}",
  "treatment": [
    "Immediate action: practical first step in ${selectedLang}",
    "Organic control: natural or cultural method in ${selectedLang}",
    "Chemical control: recommended spray if severe in ${selectedLang}"
  ]
}
Output valid JSON only.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType || "image/jpeg"
              }
            }
          ]
        }
      ],
      config: { responseMimeType: "application/json" }
    });

    const parsedData = JSON.parse(response.text);
    res.json(parsedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI diagnosis failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});