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