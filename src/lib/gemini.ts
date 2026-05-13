// Proxy requests to the secure Express backend, or fallback to client-side for Netlify
async function fetchClientSide(path: string, body: any) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY is missing. You must add it to your Netlify Environment Variables to use Gemini without a backend.");
  }

  // Simplified mapping for the most common endpoints to direct Gemini REST API
  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  let prompt = '';

  if (path === 'chatAboutMeetings') {
    prompt = `Based on the following meeting summaries and tasks context:\n${body.pastContext}\n\nAnswer this user query: ${body.query}`;
  } else if (path === 'summarizeMeeting') {
    prompt = `Please summarize the following meeting transcript. Provide concise summary, key discussion points, decisions, blockers, and deadlines (Respond with JSON containing summary, points array, decisions array, blockers array, deadlines array):\n\n${body.transcript}`;
  } else if (path === 'extractTasks') {
     prompt = `Extract action items from the following meeting transcript (Respond with JSON array containing objects with title, assignee, deadline, priority, status):\n\n${body.transcript}`;
  } else if (path === 'generateStandup') {
     prompt = `Generate a daily standup update based on the following task data for the user (Respond with JSON containing yesterday, today, blockers):\n\n${body.userData}`;
  } else if (path === 'prioritizeTasks') {
     prompt = `Analyze these tasks and order them from most critical to least critical (Respond with JSON array containing objects with title, reasoning, suggestedPriority):\n\n${body.tasksChunk}`;
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    })
  });

  if (!response.ok) {
     const text = await response.text();
     console.error("Gemini API Error", text);
     throw new Error(`Gemini API Error: ${response.status}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  if (path === 'chatAboutMeetings') return { text: textResponse };
  if (path === 'summarizeMeeting' || path === 'extractTasks' || path === 'generateStandup' || path === 'prioritizeTasks') {
     // attempt JSON parse
     try {
       // remove markdown json blocks
       const clean = textResponse.replace(/^```json/m, '').replace(/```$/m, '').trim();
       return JSON.parse(clean);
     } catch (e) {
       console.error("Failed to parse Gemini JSON fallback:", textResponse);
       return path === 'extractTasks' ? [] : {};
     }
  }

  return { text: textResponse };
}

async function fetchApi(path: string, body: any) {
  try {
    const response = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    // Netlify might return a 404 HTML page if the API route doesn't exist.
    const contentType = response.headers.get('content-type');
    if (!response.ok || (contentType && contentType.includes('text/html'))) {
        // Fallback to client side if server is unreachable (e.g. Netlify static hosting)
        console.warn(`Backend /api/${path} failed. Falling back to client-side API call...`);
        return await fetchClientSide(path, body);
    }
    
    return await response.json();
  } catch (error: any) {
    if (error.message && error.message.includes("VITE_GEMINI")) {
      throw error;
    }
    console.warn("Server unreachable, attempting client-side fallback...");
    return await fetchClientSide(path, body);
  }
}

export async function summarizeMeeting(transcript: string) {
  return await fetchApi('summarizeMeeting', { transcript });
}

export async function extractTasks(transcript: string) {
  return await fetchApi('extractTasks', { transcript });
}

export async function prioritizeTasks(tasksChunk: string) {
  return await fetchApi('prioritizeTasks', { tasksChunk });
}

export async function chatAboutMeetings(query: string, pastContext: string) {
  const result = await fetchApi('chatAboutMeetings', { query, pastContext });
  return result.text;
}

export async function transcribeAudio(base64Data: string, mimeType: string) {
  const result = await fetchApi('transcribeAudio', { base64Data, mimeType });
  return result.text;
}

export async function generateStandup(userData: string) {
  return await fetchApi('generateStandup', { userData });
}

