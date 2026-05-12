// Proxy requests to the secure Express backend

async function fetchApi(path: string, body: any) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${path}`);
  }
  return response.json();
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

