const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect("mongodb://localhost:27017/chatDB")
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/homepage.html'));
});
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chat.html'));
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  let currentUser = '';

  socket.on('join', async (username) => {
    currentUser = username;
    onlineUsers.set(socket.id, username);
    io.emit('notification', `${username} joined`);
  });

  socket.on('chat message', (msgData) => {
    io.emit('chat message', msgData);
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('typing', username);
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing');
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      io.emit('notification', `${currentUser} left`);
      onlineUsers.delete(socket.id);
    }
  });
});

server.listen(8080, () => {
  console.log("Server is successfully listening on port 8080...");
});



// app link:  https://6f9a-2401-4900-8898-eb33-cc77-d45e-1f81-17b8.ngrok-free.app  //

