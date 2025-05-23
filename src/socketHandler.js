const fs = require('fs');
const path = require('path');

module.exports = (io, onlineUsers, User) => {
  const messageReactions = new Map();

  const uploadedFiles = new Map();
  const uploadDir = path.join(__dirname, 'public', 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
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
        console.log('Received message:', msgData); 
        
        const messageId = msgData.id || Date.now().toString(); 
        
        const messageToSend = {
          id: messageId,
          username: msgData.username,
          timestamp: msgData.timestamp || new Date().toISOString(),
          reactions: msgData.reactions || []
        };

        if (msgData.message) {
            if (!msgData.username || !msgData.message) {
              throw new Error('Invalid message format');
            }
            messageToSend.message = msgData.message;
        } else if (msgData.file) {
            if (!msgData.username || !msgData.file || !msgData.file.name || !msgData.file.url) {
                 throw new Error('Invalid file message format');
            }
            messageToSend.file = msgData.file;
        } else {
            if (!msgData.reactions) {
                 throw new Error('Invalid message type or missing data');
            }
             console.log('Received what looks like a reaction update as chat message, ignoring.');
             return; 
        }

        if (!messageReactions.has(messageId)) {
             const initialReactions = new Map();
             if(messageToSend.reactions && Array.isArray(messageToSend.reactions)){
                 messageToSend.reactions.forEach(r => {
                     if(r.emoji && Array.isArray(r.users)){
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
        console.log(`Starting file upload: ${name} (${size} bytes) with ID ${fileId}`);
        uploadedFiles.set(fileId, { name, type, size, data: [], uploadedSize: 0 });
    });

    socket.on('upload file chunk', ({ fileId, chunk, chunkIndex }) => {
        const fileInfo = uploadedFiles.get(fileId);
        if (!fileInfo) {
            console.error(`Received chunk for unknown file ID: ${fileId}`);
            socket.emit('error', 'Unknown file upload ID.');
            return;
        }

        console.log(`Received chunk ${chunkIndex} for file ID ${fileId}`);
        fileInfo.data[chunkIndex] = Buffer.from(chunk);
        fileInfo.uploadedSize += chunk.byteLength;
    });

    socket.on('end file upload', async ({ fileId }) => {
        const fileInfo = uploadedFiles.get(fileId);
        if (!fileInfo) {
            console.error(`Received end for unknown file ID: ${fileId}`);
            socket.emit('error', 'Unknown file upload ID.');
            return;
        }

        if (fileInfo.uploadedSize !== fileInfo.size) {
             console.error(`File size mismatch for ID ${fileId}. Expected ${fileInfo.size}, got ${fileInfo.uploadedSize}`);
             socket.emit('error', 'File upload incomplete.');
             uploadedFiles.delete(fileId); 
             return;
        }

        const fileName = `${fileId}_${fileInfo.name}`;
        const filePath = path.join(uploadDir, fileName);
        const fileUrl = `/uploads/${encodeURIComponent(fileName)}`; 

        try {
            const fileBuffer = Buffer.concat(fileInfo.data);
            await fs.promises.writeFile(filePath, fileBuffer);
            console.log(`File ${fileInfo.name} saved to ${filePath}`);

            io.emit('chat message', {
              username: currentUser,
              file: {
                  name: fileInfo.name,
                  url: fileUrl,
                  size: fileInfo.size,
                  type: fileInfo.type
              },
              timestamp: new Date().toISOString(),
              id: fileId 
            });

            uploadedFiles.delete(fileId); 

        } catch (error) {
            console.error('Error saving file:', error);
            socket.emit('error', 'Failed to save file.');
            uploadedFiles.delete(fileId);
        }
    });

    socket.on("add reaction", ({ messageId, reaction }) => {
      try {
        if (!messageReactions.has(messageId)) {
          console.warn(`Attempted to react to unknown message ID: ${messageId}. Initializing reactions map.`);
          messageReactions.set(messageId, new Map());
        }
        
        const reactionsForMessage = messageReactions.get(messageId);
        
        if (!reactionsForMessage.has(reaction)) {
          reactionsForMessage.set(reaction, new Set());
        }
        
        const reactionUsersSet = reactionsForMessage.get(reaction);
        
        const userAlreadyReactedWithThisEmoji = reactionUsersSet.has(currentUser);
        
        if (userAlreadyReactedWithThisEmoji) {
          reactionUsersSet.delete(currentUser);
        } else {
          reactionUsersSet.add(currentUser);
        }
        
        if (reactionsForMessage.size === 0) {
          reactionsForMessage.delete(reaction);
        }
        
        if (messageReactions.size === 0) {
            messageReactions.delete(messageId);
        }

   
        if(messageReactions.has(messageId)) {
            io.emit("reaction update", {
              messageId,
              reactions: Array.from(messageReactions.get(messageId).entries()).map(([emoji, users]) => ({
                emoji,
                users: Array.from(users)
              }))
            });
        } else {
             io.emit("reaction update", { messageId, reactions: [] });
        }

      } catch (error) {
        console.error("Error in add reaction event:", error);
        socket.emit("error", "Failed to add reaction");
      }
    });

    // Handle message deletion
    socket.on('delete message', ({ messageId }) => {
        console.log(`Attempting to delete message with ID: ${messageId}`);
        // In a real application, you would verify user permissions and delete from a database.
        // For this example, we'll just notify clients to remove the message by its ID.
        io.emit('message deleted', { messageId });
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