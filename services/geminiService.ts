import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Earthquake, Volcano, RawVolcano, VolcanoStatus } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const enrichVolcanoData = async (rawVolcanoes: RawVolcano[]): Promise<Volcano[]> => {
    if (!API_KEY) {
        console.warn("API_KEY not set. Returning raw volcano data without enrichment.");
        return rawVolcanoes.map((v, i) => ({
            ...v,
            id: `v_raw_${i}`,
            elevation: 0,
            type: 'Unknown',
            status: VolcanoStatus.Inactive,
            information: "AI enrichment is disabled. Please set the API Key."
        }));
    }

    const BATCH_SIZE = 50; // Process in batches to avoid overly large prompts
    const allEnrichedVolcanoes: Volcano[] = [];

    for (let i = 0; i < rawVolcanoes.length; i += BATCH_SIZE) {
        const batch = rawVolcanoes.slice(i, i + BATCH_SIZE);
        const volcanoList = batch.map((v, index) => `${index + 1}. ${v.name}`).join('\n');
        
        const prompt = `For the following numbered list of volcanoes, provide their geological data.
---
${volcanoList}
---

I need the following information for each volcano:
1.  **type**: The geological type (e.g., Stratovolcano, Shield volcano, Caldera).
2.  **status**: The current operational status. Choose exactly one from: "Active", "Inactive", "Potentially Active".
3.  **elevation**: The summit elevation in meters (as an integer).
4.  **information**: A single, fascinating historical or geological fact about the volcano (e.g., a famous eruption, its unique formation, cultural significance). Keep it to one sentence.

Return a JSON array where each object corresponds to a volcano in the input list, maintaining the original order. The JSON array must contain exactly ${batch.length} items.`;
        
        console.log(`Enriching volcano batch ${i / BATCH_SIZE + 1}...`);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, description: "Geological type of the volcano." },
                                status: { type: Type.STRING, description: `Activity status. Must be one of: ${Object.values(VolcanoStatus).join(', ')}.` },
                                elevation: { type: Type.INTEGER, description: "Summit elevation in meters." },
                                information: { type: Type.STRING, description: "A single, fascinating fact about the volcano." },
                            },
                            required: ["type", "status", "elevation", "information"]
                        }
                    }
                }
            });

            const enrichedDetails = JSON.parse(response.text);

            if (enrichedDetails.length !== batch.length) {
                console.error(`Mismatch details: Expected ${batch.length}, got ${enrichedDetails.length}. Response text:`, response.text);
                throw new Error(`Mismatch in batch. Expected ${batch.length}, got ${enrichedDetails.length}`);
            }

            const enrichedBatch = batch.map((volcano, index) => ({
                ...volcano,
                id: `v_${i + index}_${volcano.name.replace(/\s+/g, '')}`,
                type: enrichedDetails[index].type,
                status: Object.values(VolcanoStatus).includes(enrichedDetails[index].status) 
                        ? enrichedDetails[index].status as VolcanoStatus 
                        : VolcanoStatus.Inactive,
                elevation: enrichedDetails[index].elevation,
                information: enrichedDetails[index].information,
            }));
            allEnrichedVolcanoes.push(...enrichedBatch);

        } catch (error) {
            console.error(`Error enriching volcano data for batch starting at index ${i}:`, error);
            // Fallback for the failed batch so the app can still show something for them
            const fallbackBatch = batch.map((v, index) => ({
                ...v,
                id: `v_fallback_${i + index}`,
                elevation: 0,
                type: 'Enrichment Failed',
                status: VolcanoStatus.Inactive,
                information: 'Could not retrieve details for this volcano.',
            }));
            allEnrichedVolcanoes.push(...fallbackBatch);
        }
    }

    return allEnrichedVolcanoes;
};


export const generateEarthquakeSummary = async (earthquake: Earthquake): Promise<string> => {
  if (!API_KEY) return "AI summaries are unavailable. Please configure the API Key.";

  const prompt = `Provide a brief, engaging summary for the following earthquake event. Mention its location, magnitude, depth, and potential context (e.g., relation to a known fault line if applicable, but don't invent information). Keep it concise (2-3 sentences).

Data:
- Location: ${earthquake.place}
- Magnitude: ${earthquake.mag ?? 'Not available'}
- Depth: ${earthquake.depth} km
- Date: ${new Date(earthquake.time).toUTCString()}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating earthquake summary:", error);
    return "Could not generate AI summary for this event.";
  }
};
