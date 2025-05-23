require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/User");
const handleSocketConnections = require("./socketHandler");
const router = require("./router");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://raxitsanghani:raxit9595@cluster0.k1ba3t3.mongodb.net/", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected successfully"))
.catch(err => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

app.use('/', router);

const onlineUsers = new Map();

handleSocketConnections(io, onlineUsers, User);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("Server is running on port 8080");
});
