const socket = io();

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');

form.addEventListener('submit', function (e) {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', input.value);
    input.value = '';
    socket.emit('stop typing');
  }
});

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

socket.on('chat message', function (msg) {
  const item = document.createElement('li');
  item.textContent = msg;
  messages.appendChild(item);
  scrollToBottom();
});

input.addEventListener('input', () => {
  if (input.value) {
    socket.emit('typing');
  } else {
    socket.emit('stop typing');
  }
});

socket.on('typing', () => {
  typingIndicator.textContent = 'Someone is typing...';
});

socket.on('stop typing', () => {
  typingIndicator.textContent = '';
});
