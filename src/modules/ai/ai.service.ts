import { groqFastModel, groqProModel } from "../../config/groq";
import prisma from "../../config/database";

const aiService = {
  // AI Feature 1: Generate Course Description
  async generateCourseDescription(title: string, category: string, level: string, topics: string[]) {
    const prompt = `You are an expert e-learning content creator. Generate a professional, engaging course description for the following course:

Title: ${title}
Category: ${category}
Level: ${level}
Topics: ${topics.join(", ")}

Return ONLY a valid JSON object with this exact structure:
{
  "description": "A detailed 3-4 paragraph course description (200-300 words)",
  "shortDesc": "A concise 1-2 sentence summary (50-80 words)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "learningOutcomes": ["outcome1", "outcome2", "outcome3", "outcome4"],
  "targetAudience": "Description of who this course is for"
}`;

    const result = await groqFastModel.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  },

  // AI Feature 2: Generate Quiz Questions
  async generateQuiz(courseTitle: string, lessonContent: string, numQuestions: number = 5) {
    const prompt = `You are an expert educator. Create a quiz based on the following course content:

Course: ${courseTitle}
Content: ${lessonContent.substring(0, 2000)}

Generate exactly ${numQuestions} multiple-choice questions.
Return ONLY a valid JSON object:
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

    const result = await groqFastModel.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  },

  // AI Feature 3: Smart Course Recommendations
  async getSmartRecommendations(userId: string) {
    // Get user's enrolled courses and interests
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

    const userHistory = enrollments.map(e =>
      `${e.course.title} (${e.course.category}, ${e.course.level})`
    ).join(", ");

    const courseList = availableCourses.map((c, i) =>
      `${i}: ${c.title} | ${c.category} | ${c.level} | Rating: ${c.rating}`
    ).join("\n");

    const prompt = `You are a smart course recommendation engine. 
    
User's learning history: ${userHistory || "No history yet - recommend popular beginner courses"}

Available courses:
${courseList}

Return ONLY a valid JSON object:
{
  "recommendations": [
    { "index": 0, "reason": "Why this course is recommended" }
  ]
}
Recommend the top 4 most relevant courses. Use 0-based index from the available courses list.`;

    const result = await groqFastModel.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return parsed.recommendations
      .slice(0, 4)
      .map((rec: { index: number; reason: string }) => ({
        course: availableCourses[rec.index],
        reason: rec.reason,
      }))
      .filter((r: any) => r.course);
  },

  // AI Feature 4: AI Study Assistant (Chat)
  async chatWithAssistant(userId: string, sessionId: string, message: string) {
    // Get recent chat history
    const history = await prisma.chatMessage.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    const contextMessages = history.map(h => ({
      role: h.role === "USER" ? "user" : "model",
      parts: [{ text: h.content }],
    }));

    const chat = groqFastModel.startChat({
      history: contextMessages,
      systemInstruction: `You are EduAI Assistant, a helpful and knowledgeable learning companion for an e-learning platform. 
You help students:
- Understand course concepts and topics
- Answer questions about programming, data science, design, business, and other subjects
- Provide study tips and learning strategies
- Explain complex topics in simple terms
- Give examples and analogies

Be encouraging, clear, and educational. Keep responses concise but informative.`,
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    // Save messages to DB
    await prisma.$transaction([
      prisma.chatMessage.create({ data: { userId, sessionId, role: "USER", content: message } }),
      prisma.chatMessage.create({ data: { userId, sessionId, role: "ASSISTANT", content: response } }),
    ]);

    return { response, sessionId };
  },

  // AI Feature 5: Auto-tag and classify course content
  async classifyContent(title: string, description: string) {
    const prompt = `You are a content classification expert for an e-learning platform.
    
Analyze this course:
Title: ${title}
Description: ${description}

Return ONLY a valid JSON object:
{
  "category": "Main category (Web Development / Data Science / Design / Business / Marketing / Language / Other)",
  "level": "BEGINNER or INTERMEDIATE or ADVANCED",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "estimatedDuration": 120,
  "prerequisites": ["prerequisite1", "prerequisite2"]
}
estimatedDuration is in minutes.`;

    const result = await groqFastModel.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  },

  async getChatHistory(userId: string, sessionId: string) {
    return prisma.chatMessage.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: "asc" },
    });
  },

  async getChatSessions(userId: string) {
    const sessions = await prisma.chatMessage.groupBy({
      by: ["sessionId"],
      where: { userId, role: "USER" },
      _max: { createdAt: true },
      _count: true,
      orderBy: { _max: { createdAt: "desc" } },
      take: 20,
    });
    return sessions;
  },
};

export default aiService;
