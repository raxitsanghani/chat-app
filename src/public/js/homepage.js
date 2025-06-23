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

// Layout mode switch logic
function isMobileDevice() {
    return window.matchMedia('(max-width: 768px)').matches || /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

function setLayoutMode(mode) {
    if (mode === 'mobile') {
        document.body.classList.add('mobile-mode');
        localStorage.setItem('layoutMode', 'mobile');
        if (layoutSwitchButton) {
            layoutSwitchButton.textContent = '💻 Desktop UI';
            layoutSwitchButton.title = 'Switch to Desktop UI';
        }
    } else {
        document.body.classList.remove('mobile-mode');
        localStorage.setItem('layoutMode', 'desktop');
        if (layoutSwitchButton) {
            layoutSwitchButton.textContent = '📱 Mobile UI';
            layoutSwitchButton.title = 'Switch to Mobile UI';
        }
    }
}

// Add layout switch button
let layoutSwitchButton = document.getElementById('layout-switch-button');
if (!layoutSwitchButton) {
    layoutSwitchButton = document.createElement('button');
    layoutSwitchButton.id = 'layout-switch-button';
    layoutSwitchButton.className = 'mode-switch-button';
    // Insert after the theme switch button
    const modeSwitchButton = document.getElementById('mode-switch-button');
    if (modeSwitchButton && modeSwitchButton.parentNode) {
        modeSwitchButton.parentNode.insertBefore(layoutSwitchButton, modeSwitchButton.nextSibling);
    }
}

// Initial mode detection
const savedLayoutMode = localStorage.getItem('layoutMode');
if (savedLayoutMode) {
    setLayoutMode(savedLayoutMode);
} else if (isMobileDevice()) {
    setLayoutMode('mobile');
} else {
    setLayoutMode('desktop');
}

layoutSwitchButton.addEventListener('click', () => {
    const currentMode = document.body.classList.contains('mobile-mode') ? 'mobile' : 'desktop';
    setLayoutMode(currentMode === 'mobile' ? 'desktop' : 'mobile');
}); 