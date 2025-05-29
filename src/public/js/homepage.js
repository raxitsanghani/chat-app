document.getElementById('privateRoomLink').addEventListener('click', function(e) {
    e.preventDefault();
    const privateRoomForm = document.getElementById('privateRoomForm');
    privateRoomForm.style.display = privateRoomForm.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('joinForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const roomKey = document.getElementById('roomKey').value.trim();
    
    if (username.length >= 3 && username.length <= 20) {
        sessionStorage.setItem('username', username);
        if (roomKey) {
            sessionStorage.setItem('roomKey', roomKey);
        }
        window.location.href = '/chat';
    }
});

// Add dark mode toggle functionality
const modeSwitchButton = document.getElementById('mode-switch-button');

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

// Apply saved theme or default to system preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    setTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
} else {
    setTheme('light');
}

// Add event listener to the mode switch button
if (modeSwitchButton) {
    modeSwitchButton.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'light';
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
} 