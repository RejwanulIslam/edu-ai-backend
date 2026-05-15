import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

// Helper: generateContent wrapper
function createModel(model: string, config: { temperature: number; top_p: number; max_tokens: number }) {
  return {
    model,
    generationConfig: config,

    // Gemini-style generateContent → Groq chat completion
    async generateContent(prompt: string) {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: config.temperature,
        top_p: config.top_p,
        max_tokens: config.max_tokens,
      });

      return {
        response: {
          text: () => completion.choices[0]?.message?.content || "",
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

export default groq;