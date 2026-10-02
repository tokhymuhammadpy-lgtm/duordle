(function () {
  const { socket, ensureRegistered, setLobbyId } = window.Duordle;

  const lengthSlider = document.getElementById('length-slider');
  const lengthValue = document.getElementById('length-value');
  const lengthJoke = document.getElementById('length-joke');
  const visibilitySelect = document.getElementById('visibility-select');
  const playersSelect = document.getElementById('players-select');
  const roundsSelect = document.getElementById('rounds-select');
  const createSubmitBtn = document.getElementById('create-submit-btn');
  const createError = document.getElementById('create-error');

  // Funny strings as the host drags the letter-count slider.
  const jokes = {
    3: "easy lmao",
    4: "still nth",
    5: "ngl, that's real work",
    6: "dayum",
    7: "a bit dif, kid",
    8: "hmm, you sure?",
    9: "borderline unhinged",
    10: "son 🙏🏿",
  };

  function updateJoke() {
    const val = Number(lengthSlider.value);
    lengthValue.textContent = val;
    lengthJoke.textContent = jokes[val] || '';
    if (val === 10) {
      lengthJoke.style.color = 'var(--color-danger)';
      lengthJoke.style.fontWeight = '700';
    } else {
      lengthJoke.style.color = '';
      lengthJoke.style.fontWeight = '';
    }
  }
  lengthSlider.addEventListener('input', updateJoke);
  updateJoke();

  ensureRegistered(() => {
    createSubmitBtn.addEventListener('click', () => {
      createSubmitBtn.disabled = true;
      createError.textContent = '';

      const settings = {
        isPublic: visibilitySelect.value === 'public',
        wordLength: Number(lengthSlider.value),
        maxPlayers: Number(playersSelect.value),
        rounds: Number(roundsSelect.value),
      };

      socket.emit('createLobby', settings, (res) => {
        createSubmitBtn.disabled = false;
        if (!res || !res.ok) {
          createError.textContent = (res && res.error) || 'Could not create lobby.';
          return;
        }
        setLobbyId(res.lobbyId);
        window.location.href = '/lobby.html';
      });
    });
  });
})();
