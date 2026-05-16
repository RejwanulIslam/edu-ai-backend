import { groqFastModel } from "../../config/groq";
import prisma from "../../config/database";
import { parseJsonFromLlm } from "../../utils/llm-json";

async function generateJson<T>(prompt: string): Promise<T> {
  const result = await groqFastModel.generateContent(prompt, { json: true });
  return parseJsonFromLlm<T>(result.response.text());
}

const LEVELS = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

function normalizeLevel(level: unknown): string {
  const upper = String(level ?? "BEGINNER").toUpperCase();
  return LEVELS.has(upper) ? upper : "BEGINNER";
}

const aiService = {
  async generateCourseDescription(title: string, category: string, level: string, topics: string[]) {
    const prompt = `You are an expert e-learning content creator. Generate a professional, engaging course description.

Title: ${title}
Category: ${category}
Level: ${level}
Topics: ${topics.length ? topics.join(", ") : "general topics"}

Return a JSON object with this exact structure:
{
  "description": "A detailed 3-4 paragraph course description (200-300 words)",
  "shortDesc": "A concise 1-2 sentence summary (50-80 words)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "learningOutcomes": ["outcome1", "outcome2", "outcome3", "outcome4"],
  "targetAudience": "Description of who this course is for"
}`;

    return generateJson<{
      description: string;
      shortDesc: string;
      tags: string[];
      learningOutcomes: string[];
      targetAudience: string;
    }>(prompt);
  },

  async generateQuiz(courseTitle: string, lessonContent: string, numQuestions: number = 5) {
    const prompt = `You are an expert educator. Create a quiz based on this course content.

Course: ${courseTitle}
Content: ${lessonContent.substring(0, 2000)}

Generate exactly ${numQuestions} multiple-choice questions.
Return a JSON object:
{
  "title": "Quiz title",
  "questions": [
    {
      "text": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}
The "answer" field is the 0-based index of the correct option.`;

    return generateJson(prompt);
  },

  async getSmartRecommendations(userId: string) {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: { course: { select: { category: true, level: true, tags: true, title: true } } },
      take: 10,
    });

    const availableCourses = await prisma.course.findMany({
      where: {
        isPublished: true,
        enrollments: { none: { userId } },
      },
      include: { instructor: { select: { name: true } } },
      take: 20,
    });

    if (availableCourses.length === 0) return [];

    const userHistory = enrollments
      .map((e) => `${e.course.title} (${e.course.category}, ${e.course.level})`)
      .join(", ");

    const courseList = availableCourses
      .map((c, i) => `${i}: ${c.title} | ${c.category} | ${c.level} | Rating: ${c.rating}`)
      .join("\n");

    const prompt = `You are a smart course recommendation engine.

User's learning history: ${userHistory || "No history yet - recommend popular beginner courses"}

Available courses:
${courseList}

Return a JSON object:
{
  "recommendations": [
    { "index": 0, "reason": "Why this course is recommended" }
  ]
}
Recommend the top 4 most relevant courses. Use 0-based index from the available courses list.`;

    const parsed = await generateJson<{ recommendations: { index: number; reason: string }[] }>(prompt);

    return (parsed.recommendations ?? [])
      .slice(0, 4)
      .map((rec) => ({
        course: availableCourses[rec.index],
        reason: rec.reason,
      }))
      .filter((r) => r.course);
  },

  async chatWithAssistant(userId: string, sessionId: string, message: string) {
    const history = await prisma.chatMessage.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    const contextMessages = history.map((h) => ({
      role: h.role === "USER" ? "user" : "model",
      parts: [{ text: h.content }],
    }));

    const chat = groqFastModel.startChat({
      history: contextMessages,
      systemInstruction: `You are EduAI Assistant, a helpful learning companion for an e-learning platform.
Help students understand concepts, answer subject questions, and give study tips.
Be encouraging, clear, and concise.`,
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    await prisma.$transaction([
      prisma.chatMessage.create({ data: { userId, sessionId, role: "USER", content: message } }),
      prisma.chatMessage.create({ data: { userId, sessionId, role: "ASSISTANT", content: response } }),
    ]);

    return { response, sessionId };
  },

  async classifyContent(title: string, description: string) {
    const body = description?.trim() || title;
    const prompt = `You are a content classification expert for an e-learning platform.

Analyze this course:
Title: ${title}
Description: ${body}

Return a JSON object with these fields only:
{
  "category": "One of: Web Development, Data Science, Design, Business, Marketing, Language, Technology, Other",
  "level": "BEGINNER or INTERMEDIATE or ADVANCED",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "estimatedDuration": 120,
  "prerequisites": ["prerequisite1", "prerequisite2"]
}
estimatedDuration is in minutes. level must be exactly BEGINNER, INTERMEDIATE, or ADVANCED.`;

    const parsed = await generateJson<{
      category?: string;
      level?: string;
      tags?: string[];
      estimatedDuration?: number;
      prerequisites?: string[];
    }>(prompt);

    return {
      category: parsed.category ?? "Other",
      level: normalizeLevel(parsed.level),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
      estimatedDuration: Number(parsed.estimatedDuration) || 120,
      prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [],
    };
  },

  async getChatHistory(userId: string, sessionId: string) {
    return prisma.chatMessage.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: "asc" },
    });
  },

  async getChatSessions(userId: string) {
    return prisma.chatMessage.groupBy({
      by: ["sessionId"],
      where: { userId, role: "USER" },
      _max: { createdAt: true },
      _count: true,
      orderBy: { _max: { createdAt: "desc" } },
      take: 20,
    });
  },
};

export default aiService;
