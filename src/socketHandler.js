module.exports = (io, onlineUsers, User) => {
  io.on("connection", (socket) => {
    let currentUser = "";

    socket.on("join", async (username) => {
      try {
        currentUser = username;
        onlineUsers.set(socket.id, username);

        // Update user status in database
        await User.findOneAndUpdate(
          { username },
          { isOnline: true },
          { upsert: true }
        );

        // Notify all users
        io.emit("notification", `${username} joined`);
        io.emit("userList", Array.from(onlineUsers.values()));
        
        // Send confirmation to the joining user
        socket.emit("notification", "You have joined the chat");
      } catch (error) {
        console.error("Error in join event:", error);
        socket.emit("error", "Failed to join chat");
      }
    });

    socket.on("chat message", (msgData) => {
      try {
        console.log('Received message:', msgData); // Debug log
        if (!msgData.username || !msgData.message) {
          throw new Error('Invalid message format');
        }
        
        // Broadcast the message to all clients
        io.emit("chat message", {
          username: msgData.username,
          message: msgData.message,
          timestamp: msgData.timestamp || new Date().toISOString()
        });
      } catch (error) {
        console.error("Error in chat message event:", error);
        socket.emit("error", "Failed to send message");
      }
    });

    socket.on("typing", (username) => {
      socket.broadcast.emit("typing", username);
    });

    socket.on("stop typing", () => {
      socket.broadcast.emit("stop typing");
    });

    socket.on("disconnect", async () => {
      if (currentUser) {
        try {
          // Update user status in database
          await User.findOneAndUpdate(
            { username: currentUser },
            { isOnline: false }
          );

          onlineUsers.delete(socket.id);
          io.emit("notification", `${currentUser} left`);
          io.emit("userList", Array.from(onlineUsers.values()));
        } catch (error) {
          console.error("Error in disconnect event:", error);
        }
      }
    });
  });
}; 