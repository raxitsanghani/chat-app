# Real-time Chat Application

A modern, real-time chat application built with Node.js, Express, Socket.IO, and MongoDB.

## Features

- Real-time messaging
- User presence (online/offline status)
- Typing indicators
- User list
- Clean and modern UI
- Responsive design
- Message timestamps
- Session management

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd chat-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following content:
```
PORT=8080
MONGODB_URI=mongodb://localhost:27017/chatDB
NODE_ENV=development
SESSION_SECRET=your-secret-key-here
```

4. Start MongoDB:
```bash
# Make sure MongoDB is running on your system
```

5. Start the application:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:8080`

## Project Structure

```
chat-app/
├── src/
│   ├── models/
│   │   └── User.js
│   ├── public/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── chat.html
│   │   └── homepage.html
│   └── server.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Technologies Used

- **Backend:**
  - Node.js
  - Express.js
  - Socket.IO
  - MongoDB with Mongoose

- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript (ES6+)
  - Socket.IO Client

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Socket.IO for real-time communication
- Express.js for the web framework
- MongoDB for the database 