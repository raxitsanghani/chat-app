const username = sessionStorage.getItem('username');
const roomKey = sessionStorage.getItem('roomKey');

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
const CHUNK_SIZE = 50 * 1024;

const emojiButton = document.getElementById('emoji-button');

const EMOJIS = [
    '😀', '😂', '😍', '👍', '😢', '😡', '🥳', '🤩', '🤔', '🙌', 
    '😊', '😇', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', 
    '🤪', '😝', '🤑', '🤭', '🤫', '🤐', '🤨', '😐', '😑', '😶',
    '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✋', '🤚', '🖐️', 
    '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👊', '🤛', '🤜',
    '👋'
]; 

function setTheme(theme) {
    const htmlElement = document.documentElement;
    if (theme === 'dark') {
        htmlElement.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        if (modeSwitchButton) {
            modeSwitchButton.textContent = '☀️ Light Mode';
            modeSwitchButton.title = 'Switch to Light Mode';
        }
    } else {
        htmlElement.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        if (modeSwitchButton) {
            modeSwitchButton.textContent = '🌙 Dark Mode';
            modeSwitchButton.title = 'Switch to Dark Mode';
        }
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
    const inputContainer = document.querySelector('.message-input-container');
    const inputRect = inputContainer.getBoundingClientRect();

    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
    
    if (emojiPicker.style.display === 'grid') {
        emojiPicker.style.position = 'fixed';
        emojiPicker.style.bottom = `${window.innerHeight - inputRect.top + 5}px`;
        emojiPicker.style.left = `${inputRect.left + 10}px`;
        emojiPicker.style.right = 'auto';
        emojiPicker.style.zIndex = '1001';
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

socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('join', { username, roomKey });
    
    const roomIdDisplay = document.getElementById('room-id-display');
    if (roomKey) {
        roomIdDisplay.textContent = `Room ID: ${roomKey}`;
    } else {
        roomIdDisplay.textContent = 'Room ID: public';
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

socket.on('chat message', (msgData) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msgData.username === username ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = msgData.id;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.style.position = 'relative';

    if (msgData.username === username) {
        const moreMenuWrapper = document.createElement('div');
        moreMenuWrapper.className = 'message-more-menu-wrapper';
        moreMenuWrapper.style.position = 'absolute';
        moreMenuWrapper.style.top = '8px';
        moreMenuWrapper.style.right = '12px';

        const moreButton = document.createElement('button');
        moreButton.className = 'message-more-btn';
        moreButton.innerHTML = '&#8942;';
        moreButton.title = 'More options';
        moreButton.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.message-more-dropdown').forEach(el => el.style.display = 'none');
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };
        moreMenuWrapper.appendChild(moreButton);

        const dropdown = document.createElement('div');
        dropdown.className = 'message-more-dropdown';
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.top = '28px';
        dropdown.style.right = '0';
        dropdown.style.zIndex = '10';

        const editOption = document.createElement('div');
        editOption.className = 'message-more-option';
        editOption.innerHTML = '<span class="option-icon">✏️</span> Edit Message';
        editOption.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = 'none';
            enableMessageEditing(messageDiv, msgData);
        };
        dropdown.appendChild(editOption);

        const deleteOption = document.createElement('div');
        deleteOption.className = 'message-more-option';
        deleteOption.innerHTML = '<span class="option-icon">🗑️</span> Delete Message';
        deleteOption.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = 'none';
            if (confirm('Are you sure you want to delete this message?')) {
                socket.emit('delete message', { messageId: msgData.id });
            }
        };
        dropdown.appendChild(deleteOption);

        moreMenuWrapper.appendChild(dropdown);
        messageContent.appendChild(moreMenuWrapper);

        document.addEventListener('click', (e) => {
            if (!moreMenuWrapper.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    const actionsBottomLeft = document.createElement('div');
    actionsBottomLeft.className = 'message-actions-bottom-left';
    actionsBottomLeft.style.position = 'absolute';
    actionsBottomLeft.style.bottom = '8px';
    actionsBottomLeft.style.left = '12px';
    actionsBottomLeft.style.display = 'flex';
    actionsBottomLeft.style.gap = '8px';

    const reactionButton = document.createElement('button');
    reactionButton.className = 'action-button reaction-button';
    reactionButton.innerHTML = '😀';
    reactionButton.title = 'Add reaction';
    reactionButton.onclick = (e) => {
        e.stopPropagation();
        showReactionPicker(e, msgData.id);
    };
    actionsBottomLeft.appendChild(reactionButton);
    messageContent.appendChild(actionsBottomLeft);

    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username';
    usernameDiv.textContent = msgData.username;

    let messageText;
    if (msgData.file) {
        messageText = document.createElement('div');
        messageText.className = 'message-text';
        if (msgData.file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = msgData.file.url;
            img.alt = msgData.file.name;
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            messageText.appendChild(img);
        } else {
            const link = document.createElement('a');
            link.href = msgData.file.url;
            link.textContent = `Download: ${msgData.file.name}`;
            link.target = '_blank';
            messageText.appendChild(link);
        }
    } else {
        messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = msgData.message;
    }

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'reactions-container'; 
    if (msgData.reactions && Array.isArray(msgData.reactions)) {
        msgData.reactions.forEach(({ emoji, users }) => {
            if (users && users.length > 0) {
                const reactionDiv = document.createElement('div'); 
                reactionDiv.className = 'reaction';
                reactionDiv.innerHTML = `${emoji} ${users.length}`;
                reactionDiv.title = users.join(', ');

                reactionDiv.onclick = (e) => {
                    e.stopPropagation();
                    socket.emit('add reaction', { messageId: msgData.id, reaction: emoji });
                };
                if (users.includes(username)) {
                    reactionDiv.classList.add('active');
                }
                reactionsContainer.appendChild(reactionDiv);
            }
        });
    }

    messageContent.appendChild(usernameDiv);
    messageContent.appendChild(messageText);
    messageContent.appendChild(timestampDiv);
    messageContent.appendChild(reactionsContainer);

    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

function showReactionPicker(event, messageId) {
    const rect = event.target.getBoundingClientRect();
    reactionPicker.style.display = 'flex';
    reactionPicker.style.top = `${rect.top - 50}px`;
    reactionPicker.style.left = `${rect.left}px`;
    reactionPicker.dataset.messageId = messageId;
}

function enableMessageEditing(messageDiv, msgData) {
    const messageText = messageDiv.querySelector('.message-text');
    const originalText = messageText.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'message-edit-input';
    input.value = originalText;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edit-actions';

    const saveButton = document.createElement('button');
    saveButton.className = 'edit-button';
    saveButton.textContent = 'Save';
    saveButton.onclick = () => {
        const newText = input.value.trim();
        if (newText && newText !== originalText) {
            socket.emit('edit message', { messageId: msgData.id, newText });
        }
        cancelMessageEditing(messageDiv, originalText);
    };

    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => cancelMessageEditing(messageDiv, originalText);

    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);

    messageText.replaceWith(input);
    messageDiv.appendChild(actionsDiv);
    input.focus();
}

function cancelMessageEditing(messageDiv, originalText) {
    const input = messageDiv.querySelector('.message-edit-input');
    const actionsDiv = messageDiv.querySelector('.edit-actions');
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = originalText;

    input.replaceWith(messageText);
    actionsDiv.remove();
}

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
        if (user === username) {
            userItem.classList.add('current-user');
        }
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

socket.on('message deleted', ({ messageId }) => {
    const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
});

socket.on('message edited', ({ messageId, newText }) => {
    const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const messageTextElement = messageElement.querySelector('.message-text');
        const inputElement = messageElement.querySelector('.message-edit-input');
        const buttonsContainer = messageElement.querySelector('.edit-buttons');

        if (messageTextElement) {
            messageTextElement.textContent = newText;
        } else if (inputElement) {
            const newMessageTextElement = document.createElement('div');
            newMessageTextElement.className = 'message-text';
            newMessageTextElement.textContent = newText;
            const messageContentElement = messageElement.querySelector('.message-content');
            if(messageContentElement) {
                messageContentElement.replaceChild(newMessageTextElement, inputElement);
            }
        }

        if (inputElement) {
            inputElement.remove();
        }
        if (buttonsContainer) {
            buttonsContainer.remove();
        }
    }
});

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

function handleFileUpload(file) {
    if (file.size > 600 * 1024 * 1024) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = 'File size must be less than 600MB';
        messagesContainer.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        fileInput.value = '';
        return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = 'File type not allowed. Supported types: Images, PDF, Text';
        messagesContainer.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        fileInput.value = '';
        return;
    }

    const fileId = Date.now().toString();
    const reader = new FileReader();
    let offset = 0;

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = `Uploading ${file.name}...`;
    messagesContainer.appendChild(notification);

    socket.emit('start file upload', {
        name: file.name,
        type: file.type,
        size: file.size,
        fileId
    });

    function readNextChunk() {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
    }

    reader.onload = function(e) {
        const chunk = e.target.result;
        const chunkIndex = Math.floor(offset / CHUNK_SIZE);

        socket.emit('upload file chunk', {
            fileId,
            chunk,
            chunkIndex
        });

        offset += chunk.byteLength;

        if (offset < file.size) {
            readNextChunk();
        } else {
            socket.emit('end file upload', { fileId });
        }
    };

    reader.onerror = function() {
        console.error('Error reading file');
        notification.textContent = `Error uploading ${file.name}`;
        notification.className = 'notification error';
        setTimeout(() => notification.remove(), 3000);
        socket.emit('error', 'Failed to read file');
        fileInput.value = '';
    };
}

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

socket.on('upload progress', ({ fileId, progress }) => {
    const notification = document.querySelector('.notification');
    if (notification) {
        notification.textContent = `Uploading... ${progress}%`;
    }
});

socket.on('upload started', ({ fileId }) => {
    console.log(`Upload started for ${fileId}`);
});

socket.on('upload complete', ({ fileId }) => {
    const notification = document.querySelector('.notification');
    if (notification) {
        notification.textContent = 'Upload complete!';
        setTimeout(() => notification.remove(), 3000);
    }
    fileInput.value = ''; 
}); 