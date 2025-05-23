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
let isTyping = false;

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const CHUNK_SIZE = 1024 * 50; 

const emojiButton = document.getElementById('emoji-button');

const EMOJIS = [
    '😀', '😂', '😍', '👍', '😢', '😡', '🥳', '🤩', '🤔', '🙌', 
    '😊', '😇', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', 
    '🤪', '😝', '🤑', '🤭', '🤫', '🤐', '🤨', '😐', '😑', '😶'
]; 

const emojiPicker = document.createElement('div');
emojiPicker.className = 'emoji-picker';
emojiPicker.style.display = 'none'; 

EMOJIS.forEach(emoji => {
    const button = document.createElement('button');
    button.textContent = emoji;
    button.className = 'emoji-picker-button';
    button.onclick = (e) => {
        e.stopPropagation();
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;
        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.focus();
        messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
      
    };
    emojiPicker.appendChild(button);
});
document.body.appendChild(emojiPicker);

emojiButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = emojiButton.getBoundingClientRect();
    const messagesContainerRect = messagesContainer.getBoundingClientRect(); 

    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none'; 
    
    if (emojiPicker.style.display === 'grid') { 
        const inputContainer = document.querySelector('.message-input-container');
        const inputRect = inputContainer.getBoundingClientRect();

        emojiPicker.style.bottom = `${window.innerHeight - inputRect.top + 5}px`; 
        const leftOffset = 10;
        emojiPicker.style.left = `${inputRect.left + leftOffset}px`;

        emojiPicker.style.right = 'auto';
    }
});

document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
        emojiPicker.style.display = 'none';
    }
});

const reactionPicker = document.createElement('div');
reactionPicker.className = 'reaction-picker';
reactionPicker.style.display = 'none';
reactionPicker.style.zIndex = '1002'; 
REACTIONS.forEach(emoji => {
    const button = document.createElement('button');
    button.textContent = emoji;
    button.className = 'reaction-button';
    button.onclick = (e) => {
        e.stopPropagation(); 
        const messageId = reactionPicker.dataset.messageId;
        socket.emit('add reaction', { messageId, reaction: emoji });
        reactionPicker.style.display = 'none'; 
    };
    reactionPicker.appendChild(button);
});
document.body.appendChild(reactionPicker);

document.addEventListener('click', (e) => {
    if (!reactionPicker.contains(e.target) && !e.target.classList.contains('reaction-button')) {
        reactionPicker.style.display = 'none';
    }
});

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
    messageDiv.dataset.messageId = msgData.id;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username';
    usernameDiv.textContent = msgData.username;
    
    let messageBody;
    if (msgData.file) {
        messageBody = document.createElement('a');
        messageBody.href = msgData.file.url;
        messageBody.textContent = `⬇️ ${msgData.file.name}`; 
        messageBody.target = '_blank';
        messageBody.className = 'file-link';
    } else {
        messageBody = document.createElement('div');
        messageBody.className = 'message-text';
        messageBody.textContent = msgData.message;
    }

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageContent.appendChild(usernameDiv);
    messageContent.appendChild(messageBody); 
    messageContent.appendChild(timestampDiv);

    const reactionArea = document.createElement('div');
    reactionArea.className = 'message-reaction-area';

    const addReactionButton = document.createElement('button');
    addReactionButton.className = 'reaction-button';
    addReactionButton.innerHTML = '😀';
    addReactionButton.onclick = (e) => {
        e.stopPropagation();
        const rect = addReactionButton.getBoundingClientRect();
        reactionPicker.style.display = 'flex';
        reactionPicker.style.top = `${rect.bottom + 5}px`; 
        reactionPicker.style.left = `${rect.left}px`; 
        reactionPicker.style.right = 'auto';

        reactionPicker.dataset.messageId = msgData.id;
    };
    
    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'reactions-container';

    reactionArea.appendChild(addReactionButton);
    reactionArea.appendChild(reactionsContainer); 

    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(reactionArea);
    
    messagesContainer.appendChild(messageDiv);
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('reaction update', ({ messageId, reactions }) => {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        let reactionsContainer = messageDiv.querySelector('.reactions-container');
        if (!reactionsContainer) {
             reactionsContainer = document.createElement('div');
             reactionsContainer.className = 'reactions-container';
             messageDiv.querySelector('.message-content').appendChild(reactionsContainer);
        }
        
        reactionsContainer.innerHTML = ''; 
        
        reactions.forEach(({ emoji, users }) => {
            const reactionDiv = document.createElement('div');
            reactionDiv.className = 'reaction';
            reactionDiv.innerHTML = `${emoji} ${users.length}`;
            reactionDiv.title = users.join(', ');
            
            reactionDiv.onclick = (e) => {
                e.stopPropagation();
                socket.emit('add reaction', { messageId, reaction: emoji });
            };
            
            if (users.includes(username)) {
                reactionDiv.classList.add('active');
            }
            
            reactionsContainer.appendChild(reactionDiv);
        });
    }
});

socket.on('notification', (message) => {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    messagesContainer.appendChild(notification);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('typing', (username) => {
    if (!isTyping) {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.textContent = `${username} is typing...`;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        isTyping = true;
    }
});

socket.on('stop typing', () => {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
        isTyping = false;
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
    if (error.includes('Maximum number of reactions')) {
        const notification = document.createElement('div');
        notification.className = 'notification reaction-limit';
        notification.textContent = error;
        messagesContainer.appendChild(notification);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    } else {
        alert(error);
    }
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
    }, 3000);
});

window.addEventListener('beforeunload', () => {
    socket.disconnect();
});

document.getElementById('exit-button').addEventListener('click', () => {
    sessionStorage.removeItem('username');
    window.location.href = '/';
});

uploadButton.addEventListener('click', () => {
    fileInput.click(); 
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        return; 
    }

    const fileId = `${Date.now()}-${file.name}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;

    socket.emit('start file upload', { name: file.name, type: file.type, size: file.size, fileId: fileId });

    const fileReader = new FileReader();

    fileReader.onload = function(event) {
        const chunk = event.target.result;
        socket.emit('upload file chunk', { fileId: fileId, chunk: chunk, chunkIndex: uploadedChunks });
        uploadedChunks++;

        if (uploadedChunks < totalChunks) {
            loadNextChunk();
        } else {
            socket.emit('end file upload', { fileId: fileId });
        
            fileInput.value = ''; 
        }
    };

    fileReader.onerror = function(error) {
        console.error('File reading error:', error);
        socket.emit('error', 'Failed to read file.');

        fileInput.value = '';
    };

    function loadNextChunk() {
        const start = uploadedChunks * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        fileReader.readAsArrayBuffer(file.slice(start, end));
    }

    loadNextChunk(); 
}); 