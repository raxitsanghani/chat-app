const fs = require('fs');
const path = require('path');

module.exports = (io, onlineUsers, User) => {
  const messageReactions = new Map();

  const uploadedFiles = new Map();
  const uploadDir = path.join(__dirname, 'public', 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
  }

  io.on("connection", (socket) => {
    let currentUser = "";

    socket.on("join", async (username) => {
      try {
        currentUser = username;
        onlineUsers.set(socket.id, username);

        await User.findOneAndUpdate(
          { username },
          { isOnline: true },
          { upsert: true }
        );

        io.emit("notification", `${username} joined`);
        io.emit("userList", Array.from(onlineUsers.values()));
        
        socket.emit("notification", "You have joined the chat");
      } catch (error) {
        console.error("Error in join event:", error);
        socket.emit("error", "Failed to join chat");
      }
    });

    socket.on("chat message", (msgData) => {
      try {
        if (!msgData.username || (!msgData.message && !msgData.file)) {
          throw new Error('Invalid message format');
        }

        const messageId = msgData.id || Date.now().toString();
        const messageToSend = {
          id: messageId,
          username: msgData.username,
          timestamp: msgData.timestamp || new Date().toISOString(),
          reactions: msgData.reactions || []
        };

        if (msgData.message) {
          messageToSend.message = msgData.message;
        } else if (msgData.file) {
          if (!msgData.file.name || !msgData.file.url) {
            throw new Error('Invalid file message format');
          }
          messageToSend.file = msgData.file;
        }

        if (!messageReactions.has(messageId)) {
          const initialReactions = new Map();
          if (messageToSend.reactions && Array.isArray(messageToSend.reactions)) {
            messageToSend.reactions.forEach(r => {
              if (r.emoji && Array.isArray(r.users)) {
                initialReactions.set(r.emoji, new Set(r.users));
              }
            });
          }
          messageReactions.set(messageId, initialReactions);
        }

        io.emit("chat message", messageToSend);

      } catch (error) {
        console.error("Error in chat message event:", error);
        socket.emit("error", "Failed to send message");
      }
    });

    socket.on('start file upload', ({ name, type, size, fileId }) => {
      try {
        console.log(`[UPLOAD] Start: ${name} (${size} bytes) ID: ${fileId}`);
        if (size > 900 * 1024 * 1024) {
          throw new Error('File size exceeds 900MB limit');
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
        if (!allowedTypes.includes(type)) {
          throw new Error('File type not allowed');
        }
        uploadedFiles.set(fileId, {
          name,
          type,
          size,
          data: [],
          uploadedSize: 0,
          chunks: Math.ceil(size / (1024 * 50))
        });
        socket.emit('upload started', { fileId });
      } catch (error) {
        console.error("[UPLOAD] Error in start:", error);
        socket.emit('error', error.message || 'Failed to start file upload');
      }
    });

    socket.on('upload file chunk', ({ fileId, chunk, chunkIndex }) => {
      try {
        const fileInfo = uploadedFiles.get(fileId);
        if (!fileInfo) {
          throw new Error('Unknown file upload ID');
        }
        if (chunkIndex >= fileInfo.chunks) {
          throw new Error('Invalid chunk index');
        }
        fileInfo.data[chunkIndex] = Buffer.from(chunk);
        fileInfo.uploadedSize += chunk.byteLength;
        console.log(`[UPLOAD] Chunk ${chunkIndex} received for ${fileId} (${fileInfo.uploadedSize}/${fileInfo.size})`);
        const progress = Math.round((fileInfo.uploadedSize / fileInfo.size) * 100);
        socket.emit('upload progress', { fileId, progress });
      } catch (error) {
        console.error("[UPLOAD] Error in chunk:", error);
        socket.emit('error', error.message || 'Failed to upload file chunk');
      }
    });

    socket.on('end file upload', async ({ fileId }) => {
      try {
        const fileInfo = uploadedFiles.get(fileId);
        if (!fileInfo) {
          console.error(`[UPLOAD] No fileInfo for fileId: ${fileId}`);
          throw new Error('Unknown file upload ID');
        }
        if (fileInfo.uploadedSize !== fileInfo.size) {
          console.error(`[UPLOAD] Uploaded size mismatch for fileId: ${fileId}. Uploaded: ${fileInfo.uploadedSize}, Expected: ${fileInfo.size}`);
          throw new Error('File upload incomplete');
        }
        if (fileInfo.data.length !== fileInfo.chunks || fileInfo.data.includes(undefined)) {
          console.error(`[UPLOAD] Missing chunks for fileId: ${fileId}`);
          throw new Error('Some file chunks are missing');
        }
        const timestamp = Date.now();
        const safeName = fileInfo.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}-${safeName}`;
        const filePath = path.join(uploadDir, fileName);
        const fileUrl = `/uploads/${encodeURIComponent(fileName)}`;
        const fileBuffer = Buffer.concat(fileInfo.data);
        try {
          await fs.promises.writeFile(filePath, fileBuffer);
          console.log(`[UPLOAD] File saved: ${filePath}`);
        } catch (err) {
          console.error(`[UPLOAD] Error saving file: ${filePath}`, err);
          socket.emit('error', 'Failed to save uploaded file.');
          uploadedFiles.delete(fileId);
          return;
        }
        if (!currentUser) {
          console.error(`[UPLOAD] currentUser is not set for fileId: ${fileId}`);
        }
        io.emit('chat message', {
          id: fileId,
          username: currentUser || 'Unknown',
          file: {
            name: fileInfo.name,
            url: fileUrl,
            size: fileInfo.size,
            type: fileInfo.type
          },
          timestamp: new Date().toISOString()
        });
        uploadedFiles.delete(fileId);
        socket.emit('upload complete', { fileId });
      } catch (error) {
        console.error("[UPLOAD] Error in end:", error);
        socket.emit('error', error.message || 'Failed to complete file upload');
        uploadedFiles.delete(fileId);
      }
    });

    socket.on("add reaction", ({ messageId, reaction }) => {
      try {
        if (!messageReactions.has(messageId)) {
          messageReactions.set(messageId, new Map());
        }
        
        const reactionsForMessage = messageReactions.get(messageId);
        
        if (!reactionsForMessage.has(reaction)) {
          reactionsForMessage.set(reaction, new Set());
        }
        
        const reactionUsersSet = reactionsForMessage.get(reaction);
        
        if (reactionUsersSet.has(currentUser)) {
          reactionUsersSet.delete(currentUser);
          if (reactionUsersSet.size === 0) {
            reactionsForMessage.delete(reaction);
          }
        } else {
          reactionUsersSet.add(currentUser);
        }
        
        if (reactionsForMessage.size === 0) {
          messageReactions.delete(messageId);
        }

        io.emit("reaction update", {
          messageId,
          reactions: Array.from(reactionsForMessage.entries()).map(([emoji, users]) => ({
            emoji,
            users: Array.from(users)
          }))
        });
      } catch (error) {
        console.error("Error in add reaction event:", error);
        socket.emit("error", "Failed to add reaction");
      }
    });

    socket.on('delete message', ({ messageId }) => {
      try {
        console.log(`Deleting message with ID: ${messageId}`);
        io.emit('message deleted', { messageId });
      } catch (error) {
        console.error("Error in delete message:", error);
        socket.emit('error', 'Failed to delete message');
      }
    });

    socket.on('edit message', ({ messageId, newText }) => {
      try {
        console.log(`Editing message with ID: ${messageId}`);
        io.emit('message edited', { messageId, newText });
      } catch (error) {
        console.error("Error in edit message:", error);
        socket.emit('error', 'Failed to edit message');
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