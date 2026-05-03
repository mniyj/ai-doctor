export interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

async function* streamFromServer(url: string, body: object): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("API error:", errorText);
    throw new Error("AI_SERVICE_ERROR");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("AI_SERVICE_ERROR");

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta;
        if (delta?.reasoning && !delta?.content) {
          yield '\x00THINKING';
        } else if (delta?.content) {
          yield delta.content;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export async function* chatWithGeminiStream(history: Message[], message: string, lang?: string): AsyncGenerator<string> {
  const messages = history.map((m) => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.parts.map((p) => p.text).join(''),
  }));
  messages.push({ role: 'user', content: message });

  try {
    yield* streamFromServer('/api/chat', { messages, lang });
  } catch (error) {
    console.error("Chat Stream Error:", error);
    throw new Error("AI_SERVICE_ERROR");
  }
}

export async function* analyzeImageStream(imageBuffer: string, mimeType: string, prompt: string, lang?: string): AsyncGenerator<string> {
  try {
    yield* streamFromServer('/api/analyze-image', {
      image: imageBuffer,
      mimeType,
      lang,
      prompt,
    });
  } catch (error) {
    console.error("Image Analysis Error:", error);
    throw new Error("AI_IMAGE_ANALYSIS_ERROR");
  }
}
