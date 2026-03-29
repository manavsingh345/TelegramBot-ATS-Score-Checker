# 🤖 Telegram Bot ATS Score Checker

A smart Telegram bot that analyzes resumes and provides an **ATS (Applicant Tracking System) compatibility score**.
It helps job seekers improve their resumes by identifying missing keywords, formatting issues, and optimization suggestions.

---

## 🚀 Features

* 📄 Upload resume (PDF/DOCX)
* 📊 Calculates ATS score instantly
* 🔍 Keyword matching against job descriptions
* 🧠 Resume optimization suggestions
* ⚡ Fast and automated analysis
* 🤖 Telegram bot interface
* 📁 Supports multiple resume formats
* 🛡️ Secure file processing

---

## 🛠️ Tech Stack

**Backend**

* Node.js
* Express.js

**Bot Integration**

* Telegram Bot API
* node-telegram-bot-api

**Resume Processing**

* pdf-parse
* mammoth (DOCX parser)
* Natural Language Processing (NLP)

**Optional / Advanced**

* OpenAI API / LLM
* MongoDB (for storing history)
* Docker (for deployment)

---

## 📂 Project Structure

```
telegram-ats-bot/
│
├── bot/
│   ├── bot.js
│   └── handlers/
│
├── services/
│   ├── atsChecker.js
│   ├── resumeParser.js
│   └── keywordMatcher.js
│
├── utils/
│   ├── fileUpload.js
│   └── scoreCalculator.js
│
├── uploads/
│
├── .env
├── package.json
├── Dockerfile
└── README.md
```

---

## ⚙️ Installation

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/telegram-ats-bot.git
cd telegram-ats-bot
```

---

### 2️⃣ Install dependencies

```bash
npm install
```

---

### 3️⃣ Create environment file

Create a `.env` file:

```env
BOT_TOKEN=your_telegram_bot_token
PORT=3000
OPENAI_API_KEY=your_api_key
```

---

## ▶️ Run the Bot

```bash
npm start
```

or (development mode)

```bash
npm run dev
```

---

## 🐳 Run with Docker

Build the image:

```bash
docker build -t telegram-ats-bot .
```

Run the container:

```bash
docker run -p 3000:3000 telegram-ats-bot
```

---

## 📌 Usage

1. Open Telegram
2. Search for your bot
3. Send your resume file
4. Receive ATS score and suggestions

Example response:

```
ATS Score: 78%

Missing Keywords:
- REST API
- Docker
- System Design

Suggestions:
- Add measurable achievements
- Use action verbs
- Improve formatting
```

---

## 📊 ATS Scoring Logic

The ATS score is calculated based on:

* Keyword matching
* Resume formatting
* Section presence
* File readability
* Content quality

Example formula:

```
ATS Score =
(Keyword Match * 40%) +
(Formatting * 20%) +
(Sections * 20%) +
(Readability * 20%)
```

---

## 🔐 Environment Variables

```
BOT_TOKEN
OPENAI_API_KEY
PORT
```

---

## 🧪 Future Improvements

* Resume vs Job Description matching
* Multi-language support
* Resume history dashboard
* Web interface
* AI-powered suggestions
* Resume keyword optimization
* PDF report generation

---

## 👨‍💻 Author

**Manav Singh**

Computer Science Student
Full Stack Developer
Backend & System Design Enthusiast

---

## ⭐ Contributing

Contributions are welcome!

```
Fork the repo
Create a new branch
Commit your changes
Push to the branch
Open a Pull Request
```

---

## 📄 License

MIT License

---
