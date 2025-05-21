// Check if user is logged in
const username = sessionStorage.getItem('username');
if (!username) {
    window.location.href = '/';
}

const socket = io();
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usersList = document.getElementById('users-list');
let typingTimeout;

// Join chat room
socket.emit('join', username);

// Handle incoming messages
socket.on('chat message', (msgData) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msgData.username === username ? 'sent' : 'received'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = msgData.message;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    messageInfo.textContent = `${msgData.username} • ${new Date(msgData.timestamp).toLocaleTimeString()}`;
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageInfo);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Handle notifications
socket.on('notification', (message) => {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    messagesContainer.appendChild(notification);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Handle typing indicators
socket.on('typing', (username) => {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.textContent = `${username} is typing...`;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('stop typing', () => {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
});

// Handle user list updates
socket.on('userList', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.textContent = user;
        usersList.appendChild(userItem);
    });
});

// Handle errors
socket.on('error', (error) => {
    console.error('Socket error:', error);
    alert(error);
});

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat message', {
            username,
            message,
            timestamp: new Date().toISOString()
        });
        messageInput.value = '';
        socket.emit('stop typing');
    }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    clearTimeout(typingTimeout);
    socket.emit('typing', username);
    
    typingTimeout = setTimeout(() => {
        socket.emit('stop typing');
    }, 1000);
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    socket.disconnect();
});

// Handle exit button click
document.getElementById('exit-button').addEventListener('click', () => {
    sessionStorage.removeItem('username');
    window.location.href = '/';
}); 