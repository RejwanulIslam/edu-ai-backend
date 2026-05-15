# EduAI Backend

Node.js + Express + TypeScript backend for EduAI E-learning Platform.

## Tech Stack
- **Runtime:** Node.js + Express + TypeScript
- **Auth:** Better Auth v1
- **ORM:** Prisma
- **Database:** PostgreSQL (Neon)
- **AI:** Google Gemini 1.5
- **Logging:** Winston
- **Validation:** Zod
- **Rate Limiting:** express-rate-limit

## Project Structure

```
src/
├── config/          # DB, Auth, Logger, Gemini configs
├── middlewares/     # Auth, Error, RateLimit
├── modules/
│   ├── courses/     # service / controller / router
│   ├── enrollments/ # service / controller / router
│   ├── reviews/     # service / router
│   ├── users/       # service / controller / router
│   ├── ai/          # service / router (Gemini AI)
│   └── quiz/        # service / router
├── utils/           # response helpers, async handler
└── server.ts        # entry point
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Fill in `.env`:
   - `DATABASE_URL` — Neon PostgreSQL connection string
   - `BETTER_AUTH_SECRET` — Random 32+ char string
   - `GEMINI_API_KEY` — From Google AI Studio (free)
   - `FRONTEND_URL` — Your frontend URL
   - `GOOGLE_CLIENT_ID/SECRET` — For Google OAuth (optional)

4. Push database schema:
```bash
npm run db:push
```

5. Run development server:
```bash
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| ALL | /api/auth/* | Better Auth (login/register/session) |
| GET | /api/courses | List courses (filtered/paginated) |
| GET | /api/courses/featured | Featured courses |
| GET | /api/courses/categories | All categories |
| POST | /api/courses | Create course (instructor) |
| GET | /api/courses/slug/:slug | Course by slug |
| POST | /api/enrollments/:courseId | Enroll in course |
| GET | /api/enrollments/my/all | My enrollments |
| POST | /api/reviews/:courseId | Add review |
| GET | /api/users/profile | My profile |
| PUT | /api/users/profile | Update profile |
| GET | /api/users/admin/all | All users (admin) |
| POST | /api/ai/generate-description | AI course description |
| POST | /api/ai/generate-quiz | AI quiz generator |
| GET | /api/ai/recommendations | AI recommendations |
| POST | /api/ai/chat | AI study assistant |
| POST | /api/ai/classify | AI content classifier |

## Deploy to Render

1. Create new Web Service
2. Build Command: `npm install && npm run db:push && npm run build`
3. Start Command: `npm start`
4. Add all environment variables
