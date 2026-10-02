(function () {
  const { socket, ensureRegistered, getLobbyId, escapeHtml } = window.Duordle;
  const lobbyId = getLobbyId();
  if (!lobbyId) { window.location.href = '/'; return; }

  const roundInfoEl = document.getElementById('round-info');
  const boardEl = document.getElementById('board');
  const keyboardEl = document.getElementById('keyboard');
  const opponentsContainer = document.getElementById('opponents-container');
  const opponentsPanel = document.getElementById('opponents-panel');
  const opponentsToggleBtn = document.getElementById('opponents-toggle-btn');
  const toast = document.getElementById('toast');

  const resultModal = document.getElementById('round-result-modal');
  const resultHeading = document.getElementById('result-heading');
  const resultWord = document.getElementById('result-word');
  const rankingList = document.getElementById('ranking-list');
  const nextRoundBtn = document.getElementById('next-round-btn');
  const playAgainBtn = document.getElementById('play-again-btn');

  const KEY_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','BACK'],
  ];

  let wordLength = 5;
  let maxTrials = 6;
  let currentGuess = '';
  let submittedRows = []; // {letters: string, colors: string[]}
  let finished = false;
  let amHost = false;
  const opponentState = new Map(); // socketId -> { username, rows: [], finishTimeMs, solved }

  function showToast(message, isError) {
    toast.textContent = message;
    toast.style.display = 'block';
    toast.classList.remove('shake');
    if (isError) { void toast.offsetWidth; toast.classList.add('shake'); }
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }

  // ---------------- Board ----------------
  function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < maxTrials; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'board-row';
      const submitted = submittedRows[r];
      const isCurrent = r === submittedRows.length && !finished;
      for (let c = 0; c < wordLength; c++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        if (submitted) {
          tile.textContent = submitted.letters[c];
          tile.classList.add('filled', submitted.colors[c]);
        } else if (isCurrent && currentGuess[c]) {
          tile.textContent = currentGuess[c];
          tile.classList.add('filled');
        }
        rowEl.appendChild(tile);
      }
      boardEl.appendChild(rowEl);
    }
  }

  // ---------------- Keyboard ----------------
  const keyBestColor = new Map();
  function colorRank(c) { return c === 'green' ? 3 : c === 'yellow' ? 2 : c === 'gray' ? 1 : 0; }

  function renderKeyboard() {
    keyboardEl.innerHTML = '';
    for (const row of KEY_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'keyboard-row';
      for (const key of row) {
        const btn = document.createElement('button');
        btn.className = 'key' + (key === 'ENTER' || key === 'BACK' ? ' wide' : '');
        btn.textContent = key === 'BACK' ? '\u232B' : key;
        const best = keyBestColor.get(key);
        if (best) btn.classList.add(best);
        btn.addEventListener('click', () => handleKey(key));
        rowEl.appendChild(btn);
      }
      keyboardEl.appendChild(rowEl);
    }
  }

  function handleKey(key) {
    if (finished) return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'BACK') { currentGuess = currentGuess.slice(0, -1); renderBoard(); return; }
    if (/^[A-Z]$/.test(key) && currentGuess.length < wordLength) {
      currentGuess += key;
      renderBoard();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (finished) return;
    const key = e.key.toUpperCase();
    if (key === 'ENTER') return handleKey('ENTER');
    if (key === 'BACKSPACE') return handleKey('BACK');
    if (/^[A-Z]$/.test(key)) return handleKey(key);
  });

  function submitGuess() {
    if (currentGuess.length !== wordLength) {
      showToast('Not enough letters', true);
      return;
    }
    const guess = currentGuess;
    socket.emit('submitGuess', { lobbyId, guess }, (res) => {
      if (!res || !res.ok) {
        showToast((res && res.error) || 'Invalid guess', true);
      }
      // actual board update happens via the 'ownGuessResult' event below,
      // which fires right after this ack regardless.
    });
  }

  socket.on('ownGuessResult', ({ colors, solved }) => {
    submittedRows.push({ letters: currentGuess, colors });
    for (let i = 0; i < currentGuess.length; i++) {
      const letter = currentGuess[i];
      const rank = colorRank(colors[i]);
      if (!keyBestColor.has(letter) || colorRank(keyBestColor.get(letter)) < rank) {
        keyBestColor.set(letter, colors[i]);
      }
    }
    currentGuess = '';
    if (solved || submittedRows.length >= maxTrials) {
      finished = true;
    }
    renderBoard();
    renderKeyboard();
  });

  // ---------------- Opponents panel ----------------
  function renderOpponents() {
    opponentsContainer.innerHTML = '';
    for (const [socketId, o] of opponentState) {
      const card = document.createElement('div');
      card.className = 'opponent-card';
      const status = o.finishTimeMs != null
        ? (o.solved ? `Finished \u2014 ${(o.finishTimeMs / 1000).toFixed(1)}s` : `Didn\u2019t solve \u2014 ${(o.finishTimeMs / 1000).toFixed(1)}s`)
        : 'In progress...';
      card.innerHTML = `<div class="opponent-name"><span>${escapeHtml(o.username || '...')}</span><span class="opponent-status">${status}</span></div>`;
      const grid = document.createElement('div');
      grid.className = 'opponent-grid';
      for (const row of o.rows) {
        const rowEl = document.createElement('div');
        rowEl.className = 'opponent-row';
        for (const color of row) {
          const tile = document.createElement('div');
          tile.className = 'opponent-tile ' + color;
          rowEl.appendChild(tile);
        }
        grid.appendChild(rowEl);
      }
      card.appendChild(grid);
      opponentsContainer.appendChild(card);
    }
  }

  socket.on('opponentGuess', ({ socketId, colors }) => {
    if (!opponentState.has(socketId)) opponentState.set(socketId, { rows: [], finishTimeMs: null, solved: null });
    opponentState.get(socketId).rows.push(colors);
    renderOpponents();
  });

  socket.on('playerFinished', ({ socketId, finishTimeMs, solved }) => {
    if (socketId === socket.id) return; // our own board already reflects this
    if (!opponentState.has(socketId)) opponentState.set(socketId, { rows: [], finishTimeMs: null, solved: null });
    const o = opponentState.get(socketId);
    o.finishTimeMs = finishTimeMs;
    o.solved = solved;
    renderOpponents();
  });

  opponentsToggleBtn.addEventListener('click', () => {
    opponentsPanel.classList.toggle('open');
  });

  // ---------------- Round lifecycle ----------------
  function resetForNewRound(roundIndex, totalRounds, newWordLength, newMaxTrials) {
    wordLength = newWordLength;
    maxTrials = newMaxTrials;
    currentGuess = '';
    submittedRows = [];
    finished = false;
    keyBestColor.clear();
    opponentState.clear();
    roundInfoEl.textContent = `Round ${roundIndex + 1} of ${totalRounds} \u2014 ${wordLength} letters`;
    resultModal.style.display = 'none';
    renderBoard();
    renderKeyboard();
    renderOpponents();
  }

  socket.on('roundStart', ({ roundIndex, totalRounds, wordLength: wl, maxTrials: mt }) => {
    resetForNewRound(roundIndex, totalRounds, wl, mt);
  });

  socket.on('roundResult', ({ word, ranking, isLastRound }) => {
    finished = true;
    resultHeading.textContent = isLastRound ? 'Game over!' : 'Round over';
    resultWord.textContent = word;
    rankingList.innerHTML = '';
    ranking.forEach((r, i) => {
      const li = document.createElement('li');
      if (r.socketId === socket.id) li.className = 'me';
      li.innerHTML = `<span>#${i + 1} ${escapeHtml(r.username)}</span><span>${r.totalScore} pts</span>`;
      rankingList.appendChild(li);
    });
    nextRoundBtn.style.display = !isLastRound && amHost ? 'block' : 'none';
    playAgainBtn.style.display = isLastRound && amHost ? 'block' : 'none';
    resultModal.style.display = 'flex';
  });

  socket.on('lobbyUpdate', (state) => {
    const me = state.players.find((p) => p.socketId === socket.id);
    amHost = Boolean(me && me.isHost);
    if (state.state === 'lobby') window.location.href = '/lobby.html';
  });

  nextRoundBtn.addEventListener('click', () => {
    nextRoundBtn.disabled = true;
    socket.emit('nextRound', { lobbyId }, (res) => {
      nextRoundBtn.disabled = false;
      if (!res || !res.ok) showToast((res && res.error) || 'Could not advance round.', true);
    });
  });

  playAgainBtn.addEventListener('click', () => {
    playAgainBtn.disabled = true;
    socket.emit('playAgain', { lobbyId }, (res) => {
      playAgainBtn.disabled = false;
      if (!res || !res.ok) showToast((res && res.error) || 'Could not restart game.', true);
    });
  });

  // ---------------- Entry point ----------------
  ensureRegistered(() => {
    socket.emit('rejoinLobby', { lobbyId }, (res) => {
      if (!res || !res.ok) {
        window.location.href = '/';
        return;
      }
      const me = res.state.players.find((p) => p.socketId === socket.id);
      amHost = Boolean(me && me.isHost);

      if (res.round) {
        wordLength = res.round.wordLength;
        maxTrials = res.round.maxTrials;
        roundInfoEl.textContent = `Round ${res.round.roundIndex + 1} of ${res.round.totalRounds} \u2014 ${wordLength} letters`;
        submittedRows = res.round.myGuesses.map((colors) => ({ letters: ''.padEnd(wordLength, '\u00A0'), colors }));
        finished = res.round.myFinished;
        for (const opp of res.round.opponents) {
          const username = (res.state.players.find((p) => p.socketId === opp.socketId) || {}).username;
          opponentState.set(opp.socketId, {
            username,
            rows: opp.guesses,
            finishTimeMs: opp.finishTimeMs,
            solved: opp.solved,
          });
        }
      }
      renderBoard();
      renderKeyboard();
      renderOpponents();
    });
  });

  // Fill in opponent usernames as lobbyUpdate events arrive (covers
  // players who joined/renamed after our initial snapshot).
  socket.on('lobbyUpdate', (state) => {
    for (const p of state.players) {
      if (opponentState.has(p.socketId)) opponentState.get(p.socketId).username = p.username;
    }
    renderOpponents();
  });
})();
