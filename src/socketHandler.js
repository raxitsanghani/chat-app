const fs = require('fs');
const path = require('path');

module.exports = (io, onlineUsers, User) => {
  const messageReactions = new Map();
  const privateRooms = new Map();
  const uploadedFiles = new Map();
  const messages = new Map();
  const uploadDir = path.join(__dirname, 'public', 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
  }

  io.on("connection", (socket) => {
    let currentUser = "";
    let currentRoom = "public";
    let currentUserId = socket.id; 
    socket.on("join", async (data) => {
      try {
        const { username, roomKey } = data;
        currentUser = username;
        onlineUsers.set(socket.id, username);
        currentUserId = socket.id; 

        await User.findOneAndUpdate(
          { username },
          { isOnline: true },
          { upsert: true }
        );

        if (roomKey) {
          currentRoom = roomKey;
          if (!privateRooms.has(roomKey)) {
            privateRooms.set(roomKey, new Set());
          }
          privateRooms.get(roomKey).add(socket.id);
          socket.join(roomKey);
          socket.to(roomKey).emit("notification", `${username} joined the private room`);
        } else {
          socket.join("public");
          io.to("public").emit("notification", `${username} joined`);
        }

        const roomUsers = roomKey ?
          Array.from(privateRooms.get(roomKey)).map(id => onlineUsers.get(id)) :
          Array.from(onlineUsers.values());

        io.to(currentRoom).emit("userList", roomUsers);
        socket.emit("notification", `You have joined the ${roomKey ? 'private' : 'public'} chat`);
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
          message: msgData.message,
          file: msgData.file,
          timestamp: msgData.timestamp || new Date().toISOString(),
          reactions: msgData.reactions || [],
          status: 'sent', 
          senderSocketId: socket.id 
        };

        messages.set(messageId, messageToSend); 

        if (messageToSend.reactions && Array.isArray(messageToSend.reactions)) {
            if (!messageReactions.has(messageId)) {
              messageReactions.set(messageId, new Map());
            }
            messageToSend.reactions.forEach(r => {
              if (r.emoji && Array.isArray(r.users)) {
                messageReactions.get(messageId).set(r.emoji, new Set(r.users));
              }
            });
          }

        io.to(currentRoom).emit("chat message", messageToSend);

      } catch (error) {
        console.error("Error in chat message event:", error);
        socket.emit("error", "Failed to send message");
      }
    });

    socket.on('message_seen', ({ messageId }) => {
        try {
            const message = messages.get(messageId);
            if (message && message.status !== 'seen') {
                message.status = 'seen';
                message.seenTime = new Date().toISOString();
                messages.set(messageId, message); 

                io.to(message.senderSocketId).emit('message_status_update', {
                    messageId: message.id,
                    status: message.status,
                    seenTime: message.seenTime
                });

               
            }
        } catch (error) {
            console.error("Error in message_seen event:", error);
        }
    });

    socket.on('start file upload', ({ name, type, size, fileId }) => {
      try {
        console.log(`[UPLOAD] Start: ${name} (${size} bytes) ID: ${fileId}`);
        if (size > 500 * 1024 * 1024) { // 500MB limit
          throw new Error('File size exceeds 500MB limit');
        }
        // Added support for more image types, zip, and other common file types
        const allowedTypes = [
            'image/*', // All image types
            'application/pdf',
            'text/plain',
            'application/zip',
            'application/x-zip-compressed',
            // Add other common types as needed
        ];
        
        const isFileTypeAllowed = allowedTypes.some(allowedType => {
            if (allowedType.endsWith('/*')) {
                return type.startsWith(allowedType.slice(0, -1));
            } else {
                return type === allowedType;
            }
        });

        if (!isFileTypeAllowed) {
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
        if (!messages.has(messageId)) {
             console.error(`Attempted to add reaction to non-existent message: ${messageId}`);
             socket.emit("error", "Cannot react to this message");
             return;
        }

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

        io.to(currentRoom).emit("reaction update", {
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
        messages.delete(messageId);
        messageReactions.delete(messageId); 
        io.to(currentRoom).emit('message deleted', { messageId }); 
      } catch (error) {
        console.error("Error in delete message:", error);
        socket.emit('error', 'Failed to delete message');
      }
    });

    socket.on('edit message', ({ messageId, newText }) => {
      try {
        console.log(`Editing message with ID: ${messageId}`);
        if (messages.has(messageId)) {
            messages.get(messageId).message = newText;
        }
        io.to(currentRoom).emit('message edited', { messageId, newText }); 
      } catch (error) {
        console.error("Error in edit message:", error);
        socket.emit('error', 'Failed to edit message');
      }
    });

    socket.on("typing", (username) => {
      socket.to(currentRoom).emit("typing", username);
    });

    socket.on("stop typing", () => {
      socket.to(currentRoom).emit("stop typing");
    });

    socket.on("disconnect", async () => {
      if (currentUser) {
        try {
          await User.findOneAndUpdate(
            { username: currentUser },
            { isOnline: false }
          );

          onlineUsers.delete(socket.id);

          if (currentRoom !== "public") {
            privateRooms.get(currentRoom)?.delete(socket.id);
            if (privateRooms.get(currentRoom)?.size === 0) {
              privateRooms.delete(currentRoom);
            }
            socket.to(currentRoom).emit("notification", `${currentUser} left the private room`);
          } else {
            io.to("public").emit("notification", `${currentUser} left`);
          }

          const roomUsers = currentRoom !== "public" ?
            Array.from(privateRooms.get(currentRoom) || []).map(id => onlineUsers.get(id)) :
            Array.from(onlineUsers.values());

          io.to(currentRoom).emit("userList", roomUsers);
        } catch (error) {
          console.error("Error in disconnect event:", error);
        }
      }
    });
  });
}; 