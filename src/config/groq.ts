import Groq from "groq-sdk";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured on the server");
  }
  return new Groq({ apiKey });
}

// Helper: generateContent wrapper
function createModel(model: string, config: { temperature: number; top_p: number; max_tokens: number }) {
  return {
    model,
    generationConfig: config,

    // Gemini-style generateContent → Groq chat completion
    async generateContent(prompt: string, options?: { json?: boolean }) {
      const groq = getGroqClient();
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.json ? 0.2 : config.temperature,
        top_p: config.top_p,
        max_tokens: config.max_tokens,
        ...(options?.json ? { response_format: { type: "json_object" as const } } : {}),
      });

      const content = completion.choices[0]?.message?.content || "";
      if (!content) {
        throw new Error("AI returned no content");
      }

      return {
        response: {
          text: () => content,
        },
      };
    },

    // Gemini-style startChat → Groq multi-turn chat
    startChat({ history = [], systemInstruction = "" }: {
      history?: { role: string; parts: { text: string }[] }[];
      systemInstruction?: string;
    }) {
      // Convert Gemini-style history to Groq format
      const messages: Groq.Chat.ChatCompletionMessageParam[] = [];

      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }

      for (const h of history) {
        messages.push({
          role: h.role === "user" ? "user" : "assistant",
          content: h.parts.map(p => p.text).join(""),
        });
      }

      return {
        async sendMessage(userMessage: string) {
          messages.push({ role: "user", content: userMessage });

          const groq = getGroqClient();
          const completion = await groq.chat.completions.create({
            model,
            messages,
            temperature: config.temperature,
            top_p: config.top_p,
            max_tokens: config.max_tokens,
          });

          const reply = completion.choices[0]?.message?.content || "";
          messages.push({ role: "assistant", content: reply });

          return {
            response: {
              text: () => reply,
            },
          };
        },
      };
    },
  };
}

export const groqFastModel = createModel("llama-3.1-8b-instant", {
  temperature: 0.8,
  top_p: 0.95,
  max_tokens: 2048,
});

export const groqProModel = createModel("llama-3.3-70b-versatile", {
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 4096,
});

export default getGroqClient;