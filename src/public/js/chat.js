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

const emojiButton = document.getElementById('emoji-button');

const EMOJIS = [
    '😀', '😂', '😍', '👍', '😢', '😡', '🥳', '🤩', '🤔', '🙌', 
    '😊', '😇', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', 
    '🤪', '😝', '🤑', '🤭', '🤫', '🤐', '🤨', '😐', '😑', '😶',
    '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✋', '🤚', '🖐️', 
    '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👊', '🤛', '🤜',
    '👋', '❤️', '💖', '💕', '💘', '💝', '💓', '💗', '💞', '💟', 
    '🧡', '💛', '💚', '💙', '💜', '��', '🤍', '🤎'
]; 

const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');

const ALLOWED_TYPES = {
    'image/jpeg': '🖼️',
    'image/png': '🖼️',
    'image/gif': '🖼️',
    'image/webp': '🖼️',
    'application/zip': '📦',
    'application/x-zip-compressed': '📦',
    'application/pdf': '📄',
    'text/plain': '📝',
    'application/msword': '📄',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📄',
    'application/vnd.ms-excel': '📊',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
    'application/vnd.ms-powerpoint': '📑',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📑'
};

const MAX_FILE_SIZE = 500 * 1024 * 1024;

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
    if (!reactionPicker.contains(e.target) && !e.target.closest('.message-content')) {
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
    appendMessage(msgData, msgData.username === username);
});

socket.on('file uploaded', (fileData) => {
    appendMessage({
        type: 'file',
        username: fileData.username,
        fileName: fileData.originalName,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize,
        fileUrl: fileData.fileUrl,
        timestamp: fileData.timestamp
    }, fileData.username === username);
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
        if (messageTextElement) {
            messageTextElement.textContent = newText;
        }
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        const messageId = Date.now().toString();
        socket.emit('chat message', {
            id: messageId,
            username,
            message,
            timestamp: new Date().toISOString(),
            status: 'sent'
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

function updateMessageStatusIcon(iconElement, status) {
    iconElement.classList.remove('sent', 'delivered', 'seen');
    iconElement.classList.add(status);
    if (status === 'sent') {
        iconElement.innerHTML = '✓';
        iconElement.title = 'Sent';
        iconElement.style.color = '#999';
    } else if (status === 'delivered') {
        iconElement.innerHTML = '✓✓';
        iconElement.title = 'Delivered';
        iconElement.style.color = '#999';
    } else if (status === 'seen') {
        iconElement.innerHTML = '✓✓';
        iconElement.title = 'Seen';
        iconElement.style.color = 'var(--primary-color)';
    }
}

const messageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.classList.contains('received')) {
            const messageId = entry.target.dataset.messageId;
            if (messageId) {
                socket.emit('message_seen', { messageId });
                messageObserver.unobserve(entry.target);
            }
        }
    });
}, { threshold: 0.5 });

socket.on('message_status_update', ({ messageId, status, seenTime }) => {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        const statusIcon = messageDiv.querySelector('.message-status');
        const timestampDiv = messageDiv.querySelector('.timestamp');
        if (statusIcon) {
            updateMessageStatusIcon(statusIcon, status);
            if (status === 'seen' && seenTime && timestampDiv) {
                timestampDiv.textContent += ` Seen ${new Date(seenTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                timestampDiv.classList.add('seen-time');
            }
        }
    }
});

function getFileIcon(type) {
    return ALLOWED_TYPES[type] || '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function createFilePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = getFileIcon(file.type);
    
    const info = document.createElement('div');
    info.className = 'file-info';
    
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;
    
    const size = document.createElement('div');
    size.className = 'file-size';
    size.textContent = formatFileSize(file.size);
    
    info.appendChild(name);
    info.appendChild(size);
    preview.appendChild(icon);
    preview.appendChild(info);
    
    return preview;
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

async function handleFileUpload(file) {
    if (file.size > MAX_FILE_SIZE) {
        showNotification('File size exceeds 500MB limit', 'error');
        return;
    }
    
    if (!ALLOWED_TYPES[file.type]) {
        showNotification('File type not supported', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('username', username);
        
        showNotification('Uploading file...');
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        
        showNotification('File uploaded successfully');
        
        
        
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Failed to upload file', 'error');
    }
}

uploadButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
    fileInput.value = '';
});

function appendMessage(message, isSent = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id || Date.now().toString();

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username';
    usernameDiv.textContent = message.username || username;
    messageContent.appendChild(usernameDiv);

    if (message.type === 'file') {
        const filePreview = createFilePreview({
            name: message.fileName,
            type: message.fileType,
            size: message.fileSize
        });
        
        const link = document.createElement('a');
        link.href = message.fileUrl;
        link.className = 'file-link';
        link.download = message.fileName;
        link.appendChild(filePreview);
        
        messageContent.appendChild(link);
    } else {
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = message.text || message.message;
        messageContent.appendChild(messageText);
    }

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit'
    });
    messageContent.appendChild(timestampDiv);

    const statusIcon = document.createElement('span');
    statusIcon.className = 'message-status';
    messageContent.appendChild(statusIcon);

    if (message.status) {
        updateMessageStatusIcon(statusIcon, message.status);
    } else if (isSent) {
        updateMessageStatusIcon(statusIcon, 'sent');
    }

    if (isSent) {
        const moreMenuWrapper = document.createElement('div');
        moreMenuWrapper.className = 'message-more-menu-wrapper';
        
        const moreBtn = document.createElement('button');
        moreBtn.className = 'message-more-btn';
        moreBtn.innerHTML = '⋮';
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            const dropdown = messageDiv.querySelector('.message-more-dropdown');
            if (dropdown) {
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            }
        };
        
        const dropdown = document.createElement('div');
        dropdown.className = 'message-more-dropdown';
        
        const editOption = document.createElement('button');
        editOption.className = 'message-more-option';
        editOption.innerHTML = '<span class="option-icon">✏️</span> Edit';
        editOption.onclick = () => {
            enableMessageEditing(messageDiv, message);
            dropdown.style.display = 'none';
        };
        
        const deleteOption = document.createElement('button');
        deleteOption.className = 'message-more-option';
        deleteOption.innerHTML = '<span class="option-icon">🗑️</span> Delete';
        deleteOption.onclick = () => {
            socket.emit('delete message', { messageId: message.id });
            dropdown.style.display = 'none';
        };
        
        dropdown.appendChild(editOption);
        dropdown.appendChild(deleteOption);
        moreMenuWrapper.appendChild(moreBtn);
        moreMenuWrapper.appendChild(dropdown);
        messageContent.appendChild(moreMenuWrapper);
    }

     if (message.type !== 'file') {
        messageContent.addEventListener('click', (e) => {
             if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            showReactionPicker(e, message.id);
        });
     } else {
          const filePreviewElement = messageContent.querySelector('.file-preview');
          if(filePreviewElement) {
               filePreviewElement.addEventListener('click', (e) => {
                     if (e.target.tagName === 'A' || e.target.closest('a')) {
                        return;
                    }
                   showReactionPicker(e, message.id);
               });
          }
     }


    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (!isSent && message.id) {
        messageObserver.observe(messageDiv);
    }
}