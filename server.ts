import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from '@google/genai';
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const getAI = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Add it to your server environments.");
    }
    return new GoogleGenAI({ apiKey: key });
  };

  // API Route: Summarize transcription
  app.post("/api/summarizeMeeting", async (req, res) => {
    try {
      const { transcript } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Please summarize the following meeting transcript. Provide concise summary, key discussion points, decisions, blockers, and deadlines:\n\n${transcript}`,
        config: {
          systemInstruction: 'You are an advanced AI assistant tailored for corporate teams. Summarize the meeting content in a professional, structured fashion.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              points: { type: Type.ARRAY, items: { type: Type.STRING } },
              decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
              blockers: { type: Type.ARRAY, items: { type: Type.STRING } },
              deadlines: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['summary', 'points', 'decisions', 'blockers', 'deadlines']
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: Extract Tasks
  app.post("/api/extractTasks", async (req, res) => {
    try {
      const { transcript } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract action items from the following meeting transcript:\n\n${transcript}`,
        config: {
          systemInstruction: 'You extract actionable tasks from transcripts. Return them as structured data.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                assignee: { type: Type.STRING },
                deadline: { type: Type.STRING },
                priority: { type: Type.STRING, description: "Must be exactly Low, Medium, High, or Critical" },
                status: { type: Type.STRING, description: "Must be exactly Pending" }
              },
              required: ['title', 'assignee', 'deadline', 'priority', 'status']
            }
          }
        }
      });
      res.json(JSON.parse(response.text || '[]'));
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: Prioritize Tasks
  app.post("/api/prioritizeTasks", async (req, res) => {
    try {
      const { tasksChunk } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these tasks and order them from most critical to least critical. Consider deadlines and impact:\n\n${tasksChunk}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                reasoning: { type: Type.STRING },
                suggestedPriority: { type: Type.STRING, description: "Low, Medium, High, Critical" }
              },
              required: ['title', 'reasoning', 'suggestedPriority']
            }
          }
        }
      });
      res.json(JSON.parse(response.text || '[]'));
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: Chat Assistant
  app.post("/api/chatAboutMeetings", async (req, res) => {
    try {
      const { query, pastContext } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on the following meeting summaries and tasks context:\n${pastContext}\n\nAnswer this user query: ${query}`,
        config: {
          systemInstruction: 'You are MS FlowPilot AI, a team operating system. Be helpful, concise, and refer strictly to the given context.'
        }
      });
      res.json({ text: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: Transcribe Audio
  app.post("/api/transcribeAudio", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
             role: 'user',
             parts: [
               { text: 'Please transcribe the following audio recording accurately. Return ONLY the transcription text, nothing else. If you cannot hear anything, return "No speech detected."' },
               { inlineData: { data: base64Data, mimeType } }
             ]
          }
        ],
      });
      res.json({ text: response.text || 'No transcription available.' });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: Generate Standup
  app.post("/api/generateStandup", async (req, res) => {
    try {
      const { userData } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a daily standup update based on the following task data for the user:\n\n${userData}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
             type: Type.OBJECT,
             properties: {
                yesterday: { type: Type.STRING },
                today: { type: Type.STRING },
                blockers: { type: Type.STRING }
             },
             required: ['yesterday', 'today', 'blockers']
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
