# Hackathon Setup Guide

This repository already provides:

- A Telegram bot built with `telegraf`
- A simple web form for job applications
- Resume file upload handling
- MongoDB storage for applications
- Export of applications to Excel from Telegram

It does not yet provide ATS scoring. We can build that on top of this base.

## What the current repo does

When the app runs:

1. Express starts on port `8080`
2. The Telegram bot launches using `BOT_TOKEN`
3. MongoDB connects using `MONGO_URI`
4. Resume files are saved into `public/files/...`
5. Application records are saved in MongoDB
6. A Telegram message is sent to the configured `BOT_CHAT_ID`

## What you need right now

Create a `.env` file using `.env.example`.

Required values:

- `BOT_TOKEN`
  Create this from `@BotFather` in Telegram
- `BOT_CHAT_ID`
  Start the bot, run `/chatid`, and copy the returned value
- `MONGO_URI`
  Create a free MongoDB Atlas cluster and copy the connection string

Optional for the ATS version:

- `GEMINI_API_KEY`
  Needed if we use Gemini AI for smarter suggestions, role-fit summary, and interview questions

## Local run steps

1. Install Node.js LTS
2. Run `npm install`
3. Create `.env`
4. Run `npm run dev`
5. Open `http://localhost:8080`

## Suggested hackathon feature scope

Build the bot in 3 phases so the team can demo something stable quickly.

### Phase 1: Make the Telegram flow ATS-friendly

Goal:
Collect both a resume and a job description in Telegram.

Needed changes:

- Add a new Telegram command like `/ats`
- Ask the user to upload CV
- Ask the user to paste the job description
- Save both in MongoDB

### Phase 2: Add scoring logic

Goal:
Return an ATS score with clear reasons.

First version can work without AI:

- Extract text from the job description
- Normalize words
- Remove stop words
- Compare job keywords with resume text
- Score based on keyword coverage

Return:

- ATS score out of 100
- Missing keywords
- Matched keywords
- Suggestions to improve the resume

### Phase 3: Add smart suggestions

Goal:
Make the bot feel impressive in the demo.

Options:

- AI-generated resume improvement tips
- Section-wise feedback: skills, experience, projects, education
- Better rewrite suggestions for weak bullet points
- Store previous analyses so user can compare versions

## Recommended tech additions

For resume parsing and ATS features, we will likely add:

- `pdf-parse` for PDF resumes
- `mammoth` for DOCX resumes
- `openai` if you want AI-generated feedback

## My recommended build order

1. Keep this repo as the base
2. Add `.env` and confirm the bot runs locally
3. Add a new Telegram scene for ATS analysis
4. Add CV text extraction
5. Add keyword match scoring
6. Add optional AI suggestions
7. Improve result formatting for Telegram messages

## What I need from you to continue implementation

Please send these items:

1. Your `.env` values, or at least confirm whether you already have:
   - Telegram bot token
   - MongoDB URI
   - Bot chat id
2. Which resume formats you want to support first:
   - PDF only
   - PDF and DOCX
3. Whether you want:
   - basic ATS scoring only
   - ATS scoring plus AI suggestions

If you want, I can take the next step and start implementing the `/ats` Telegram flow directly in this repo.
