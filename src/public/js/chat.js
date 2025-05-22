
const username = sessionStorage.getItem('username');
if (!username) {
    window.location.href = '/';
}

const socket = io({
    transports: ['websocket'],
    upgrade: false
});

const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usersList = document.getElementById('users-list');
const modeSwitchButton = document.getElementById('mode-switch-button');
let typingTimeout;


function setTheme(theme) {
    const htmlElement = document.documentElement;
    if (theme === 'dark') {
        htmlElement.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        if (modeSwitchButton) modeSwitchButton.textContent = 'Light Mode';
    } else {
        htmlElement.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        if (modeSwitchButton) modeSwitchButton.textContent = 'Dark Mode';
    }
}


const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    setTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
} else {
    setTheme('light');
}

if (modeSwitchButton) {
    modeSwitchButton.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'light';
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
}


socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});


socket.emit('join', username);


socket.on('chat message', (msgData) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msgData.username === username ? 'sent' : 'received'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username';
    usernameDiv.textContent = msgData.username;
    
    const messageTextDiv = document.createElement('div');
    messageTextDiv.className = 'message-text';
    messageTextDiv.textContent = msgData.message;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageContent.appendChild(usernameDiv);
    messageContent.appendChild(messageTextDiv);
    messageContent.appendChild(timestampDiv);
    
    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});


socket.on('notification', (message) => {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    messagesContainer.appendChild(notification);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});


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


socket.on('userList', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.textContent = user;
        usersList.appendChild(userItem);
    });
});


socket.on('error', (error) => {
    console.error('Socket error:', error);
    alert(error);
});


function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        console.log('Sending message:', message);
        socket.emit('chat message', {
            username,
            message,
            timestamp: new Date().toISOString()
        });
        messageInput.value = '';
        socket.emit('stop typing');
    }
}


sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); 
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


window.addEventListener('beforeunload', () => {
    socket.disconnect();
});

document.getElementById('exit-button').addEventListener('click', () => {
    sessionStorage.removeItem('username');
    window.location.href = '/';
}); 