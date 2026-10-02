// Shared socket connection + small helpers used by every page's own script.
// Keeping this separate means each page script stays focused on its own UI logic.
window.Duordle = (function () {
  const socket = io();

  function getUsername() {
    return sessionStorage.getItem('duordle_username') || '';
  }
  function setUsername(name) {
    sessionStorage.setItem('duordle_username', name);
  }
  function getLobbyId() {
    return sessionStorage.getItem('duordle_lobby_id') || '';
  }
  function setLobbyId(id) {
    sessionStorage.setItem('duordle_lobby_id', id);
  }

  // Re-register the username with the server on every page load, since the
  // server keeps no session beyond the current socket connection.
  function ensureRegistered(callback) {
    const username = getUsername();
    if (!username) {
      window.location.href = '/';
      return;
    }
    socket.emit('register', { username }, (res) => {
      if (!res || !res.ok) {
        window.location.href = '/';
        return;
      }
      callback && callback();
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { socket, getUsername, setUsername, getLobbyId, setLobbyId, ensureRegistered, escapeHtml };
})();
