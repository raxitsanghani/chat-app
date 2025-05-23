document.getElementById('joinForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    
    if (username.length >= 3 && username.length <= 20) {
        sessionStorage.setItem('username', username);
    
        window.location.href = '/chat';
    }
}); 