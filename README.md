# ThynkFlow AI
A full-stack AI ideation and chat platform built for structured brainstorming, idea evaluation, and session-based productivity workflows.

## Overview
ThynkFlow AI helps users move from rough thoughts to refined ideas through AI-assisted conversation, structured ideation flows, and scoring-based evaluation.

The product emphasizes:
- Secure authentication
- Persistent session-based chat history
- AI ideation and scoring pipelines
- Trend-aware assistance and practical product workflows

## Core Features
- AI chat with automatic prompt classification (`conversation` vs `ideation`)
- Structured multi-idea generation with clear idea titles and content blocks
- Idea scoring across:
- Novelty
- Feasibility
- Market alignment
- Session lifecycle management:
- Create new chat session
- Rename session
- View past session messages
- Delete session
- Authentication and user account workflows:
- Signup + email verification
- Login/logout
- Forgot/reset password
- Update profile name
- Delete account
- Feedback submission and system stats endpoints
- Optional trend discovery using SerpAPI

## Tech Stack
### Frontend
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Utility libraries: `lucide-react`, `react-markdown`, `remark-gfm`

### Backend
- FastAPI (Python)
- Pydantic schema validation
- JWT-based authentication
- Gemini integration via `google-generativeai`
- SMTP email workflows (verification/reset)
- File-based persistence for users/chats/feedback

## Architecture Snapshot
- `frontend/`: UI routes, dashboard/chat components, typed API client
- `backend/`: FastAPI endpoints, auth logic, AI orchestration, scoring/trend utilities
- API scope includes auth, chat, sessions, feedback, health, stats, and model refresh
- Storage model uses JSON persistence under `backend/data/`

## Security and Privacy
- Password hashing before storage
- JWT-protected API routes
- Environment-based secrets/config
- CORS configuration support
- User-isolated chat/session data organization

## High-Level Local Run Flow
1. Start backend from `backend/` with FastAPI/Uvicorn (`python main.py`)
2. Start frontend from `frontend/` (`npm install` then `npm run dev`)
3. Configure env variables for Gemini, JWT, SMTP, API URL, and optional SerpAPI

## Resume Context
This project demonstrates practical full-stack engineering:

- End-to-end system design and implementation
- Secure auth + account lifecycle flows
- AI-powered feature integration with fallback handling
- Session-based data architecture and maintainable API/UI layering

## UI Screenshots
1. Auth Screen  
`Add screenshot here`

2. Chat Workspace  
`Add screenshot here`

3. Ideation + Scoring  
`Add screenshot here`

4. Session History Sidebar  
`Add screenshot here`

5. Feedback/Settings  
`Add screenshot here`

## Contact
If you'd like a deeper technical walkthrough, feel free to connect via GitHub, LinkedIn, Instagram, or email.

