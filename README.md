🎓 ExamConnect

ExamConnect is a full-stack real-time examination and communication platform designed for students and administrators. It supports group-based chat, real-time messaging, quiz management, and secure authentication.

🚀 Live Demo
🌐 Frontend (Netlify)

👉 https://examconnect.netlify.app/

🧠 Backend Health Check (Render)

👉 https://examconnect-backend.onrender.com/api/health

🏗️ Project Architecture
examConnect/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── websocket/
│   └── app.js
│
├── frontend/
│   ├── services/
│   ├── authentication/
│   ├── chat/
│   ├── config.js
│   └── index.html

✨ Features
🔐 Authentication

JWT-based login/signup

Secure password hashing

Role-based access (Admin / Student)

💬 Real-Time Chat

Live group messaging using Socket.IO

Typing indicators

Read receipts

Message edit/delete

👥 Group System

Create, join, leave groups

Manage members

Role-based controls

📝 Quiz System

Create quizzes

Timed exams

Automatic submission

Real-time quiz updates

📁 File Sharing

Upload images, documents, and PDFs

Size/type validation

Secure static file serving

🧑‍💻 Tech Stack
Backend

Node.js

Express.js

MongoDB (Mongoose)

JWT Authentication

Socket.IO

Frontend

Vanilla JavaScript

HTML5 + CSS3

WebSockets (Socket.IO Client)

Deployment

Backend → Render

Frontend → Netlify

Database → MongoDB Atlas

⚙️ Environment Variables

Create a .env file in your backend:

PORT=3000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
NODE_ENV=production
CLIENT_URL=https://examconnect.netlify.app

🛠️ Local Setup
Clone the repo
git clone https://github.com/Vivek-Sharma00/examConnect
cd examConnect

Install dependencies
cd backend
npm install

cd ../frontend

Run locally
Backend
cd backend
npm start

Frontend

Open frontend/index.html in your browser.

✅ Health Check Endpoint
GET /api/health


Example live URL:

https://examconnect-backend.onrender.com/api/health

📌 Future Improvements

Email verification

Password reset

Push notifications

Admin analytics dashboard

👨‍💻 Author

Vivek Sharma
GitHub: https://github.com/Vivek-Sharma00
