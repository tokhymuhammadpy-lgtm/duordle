(function () {
  const usernameInput = document.getElementById('username-input');
  const usernameError = document.getElementById('username-error');
  const createBtn = document.getElementById('create-btn');
  const joinBtn = document.getElementById('join-btn');

  function validName(name) {
    return /^[A-Za-z0-9_\-]{2,16}$/.test(name.trim());
  }

  function refresh() {
    const name = usernameInput.value;
    const ok = validName(name);
    createBtn.disabled = !ok;
    joinBtn.disabled = !ok;
    usernameError.textContent = name.length > 0 && !ok
      ? 'Use 2-16 letters, numbers, _ or - only.'
      : '';
  }

  usernameInput.addEventListener('input', refresh);
  refresh();

  function saveNameAndGo(destination) {
    sessionStorage.setItem('duordle_username', usernameInput.value.trim());
    window.location.href = destination;
  }

  createBtn.addEventListener('click', () => saveNameAndGo('/create-lobby.html'));
  joinBtn.addEventListener('click', () => saveNameAndGo('/join-lobby.html'));
})();
