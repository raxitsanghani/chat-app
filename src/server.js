require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/User");
const handleSocketConnections = require("./socketHandler");


const app = express();
const server = http.createServer(app);
const io = new Server(server);


app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/chatDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected successfully"))
.catch(err => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/homepage.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public/chat.html"));
});


const onlineUsers = new Map();

handleSocketConnections(io, onlineUsers, User);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});


server.listen(8080, () => {
  console.log("Server is successfully listening on port 8080...");
});