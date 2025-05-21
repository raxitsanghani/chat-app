document.getElementById('joinForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    
    if (username.length >= 3 && username.length <= 20) {
        // Store username in sessionStorage
        sessionStorage.setItem('username', username);
        // Redirect to chat page
        window.location.href = '/chat';
    }
}); 