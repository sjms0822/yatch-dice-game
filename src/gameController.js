import confetti from 'canvas-confetti';
import { CATEGORIES, UPPER_CATEGORIES, LOWER_CATEGORIES, calculateCategoryScore, calculatePlayerTotals, createEmptyScores } from './yachtRules.js';
import { YachtAI } from './aiPlayer.js';
import { sound } from './sound.js';

export class GameController {
  constructor(physicsScene, uiElements) {
    this.physics = physicsScene;
    this.ui = uiElements;

    // 게임 상태
    this.mode = 'ai'; // 'ai' or 'pvp'
    this.round = 1;
    this.maxRounds = 12;
    this.currentPlayer = 1; // 1 or 2
    this.rollsLeft = 3;
    this.hasRolledThisTurn = false;

    // 플레이어 점수표
    this.players = {
      1: { name: '플레이어 1', scores: createEmptyScores() },
      2: { name: '인공지능 AI', scores: createEmptyScores() }
    };

    this.ai = new YachtAI('인공지능 AI');
    this.isAiTurn = false;

    // 물리 씬 이벤트 연결
    this.physics.onDiceSettled = this.handleDiceSettled.bind(this);
    this.physics.onDiceClick = this.handleDiceClicked.bind(this);

    this.setupUIEvents();
    this.startNewGame(this.mode);
  }

  setupUIEvents() {
    // 굴리기 버튼
    this.ui.btnRoll.addEventListener('click', () => {
      if (this.isAiTurn) return;
      this.executeRoll();
    });

    // 게임 모드 변경
    this.ui.btnModePvp.addEventListener('click', () => {
      if (this.mode !== 'pvp') {
        sound.playClick();
        this.startNewGame('pvp');
      }
    });

    this.ui.btnModeAi.addEventListener('click', () => {
      if (this.mode !== 'ai') {
        sound.playClick();
        this.startNewGame('ai');
      }
    });

    // 새 게임 버튼
    this.ui.btnRestart.addEventListener('click', () => {
      sound.playClick();
      if (confirm('새 게임을 시작하시겠습니까? 현재 진행 상황은 초기화됩니다.')) {
        this.startNewGame(this.mode);
      }
    });

    // 사운드 토글 버튼
    this.ui.btnMute.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      this.ui.btnMute.textContent = isMuted ? '🔇 음소거' : '🔊 사운드';
      this.ui.btnMute.classList.toggle('muted', isMuted);
    });

    // 룰북 모달 열기/닫기
    this.ui.btnHelp.addEventListener('click', () => {
      sound.playClick();
      this.ui.rulesModal.classList.add('active');
    });
    this.ui.btnCloseModal.addEventListener('click', () => {
      sound.playClick();
      this.ui.rulesModal.classList.remove('active');
    });

    // 다시 하기 모달 버튼
    this.ui.btnPlayAgain.addEventListener('click', () => {
      sound.playClick();
      this.ui.gameOverModal.classList.remove('active');
      this.startNewGame(this.mode);
    });

    // 킵 트레이 슬롯 클릭 이벤트 위임
    this.ui.keepSlots.forEach((slot, idx) => {
      slot.addEventListener('click', () => {
        if (this.isAiTurn || !this.hasRolledThisTurn || this.physics.isRolling) return;
        this.physics.toggleKeep(idx);
      });
    });
  }

  startNewGame(mode = 'ai') {
    this.mode = mode;
    this.round = 1;
    this.currentPlayer = 1;
    this.rollsLeft = 3;
    this.hasRolledThisTurn = false;
    this.isAiTurn = false;

    // 모드 버튼 UI 갱신
    this.ui.btnModePvp.classList.toggle('active', mode === 'pvp');
    this.ui.btnModeAi.classList.toggle('active', mode === 'ai');

    // 플레이어 정보 초기화
    if (mode === 'ai') {
      this.players[1] = { name: '나 (플레이어)', scores: createEmptyScores() };
      this.players[2] = { name: '인공지능 AI', scores: createEmptyScores() };
    } else {
      this.players[1] = { name: '플레이어 1', scores: createEmptyScores() };
      this.players[2] = { name: '플레이어 2', scores: createEmptyScores() };
    }

    this.ui.player1HeaderName.textContent = this.players[1].name;
    this.ui.player2HeaderName.textContent = this.players[2].name;

    this.physics.resetDicePositions();
    this.updateScorecardUI();
    this.updateTurnInfoUI();
    this.updateKeepSlotsUI();
    this.setSpeech('');
  }

  // 주사위 굴리기 실행
  executeRoll() {
    if (this.rollsLeft <= 0 || this.physics.isRolling) return;

    this.rollsLeft--;
    this.hasRolledThisTurn = true;
    this.updateTurnInfoUI();

    const keepIndices = this.physics.getKeptIndices();
    this.physics.rollDice(keepIndices);
    this.clearScorePreviews();
  }

  // 주사위가 바닥에 완전히 안착하고 멈췄을 때 호출되는 콜백
  handleDiceSettled(diceValues) {
    this.updateKeepSlotsUI();

    // 요트(50점)가 나왔는지 체크하여 서프라이즈 이펙트
    const counts = {};
    diceValues.forEach(v => counts[v] = (counts[v] || 0) + 1);
    if (Object.values(counts).includes(5)) {
      sound.playYachtFanfare();
      this.triggerConfetti();
      this.setSpeech('🎉 와우! 5개 주사위가 모두 일치! 요트(YACHT) 달성!! 🎉');
    }

    // 현재 플레이어의 비어있는 슬롯들에 획득 가능한 점수 프리뷰 표시
    this.showScorePreviews(diceValues);

    // AI의 턴인 경우 후속 작업 진행
    if (this.isAiTurn) {
      this.handleAiDecision(diceValues);
    }
  }

  handleDiceClicked(diceIndex, isKept) {
    this.updateKeepSlotsUI();
  }

  // 킵 슬롯 UI 갱신
  updateKeepSlotsUI() {
    const diceList = this.physics.diceList;
    this.ui.keepSlots.forEach((slot, idx) => {
      const dice = diceList[idx];
      if (!dice) return;

      const numEl = slot.querySelector('.slot-dice-num');
      const badgeEl = slot.querySelector('.slot-status-badge');

      numEl.textContent = dice.value;
      slot.classList.toggle('kept', dice.isKept);
      slot.classList.toggle('disabled', !this.hasRolledThisTurn || this.physics.isRolling);

      badgeEl.textContent = dice.isKept ? 'KEEP' : 'ROLL';
    });
  }

  // 점수판 프리뷰 표시
  showScorePreviews(diceValues) {
    const pScores = this.players[this.currentPlayer].scores;

    Object.keys(CATEGORIES).forEach(catId => {
      const cell = document.getElementById(`score-${this.currentPlayer}-${catId}`);
      if (!cell) return;

      if (pScores[catId] === null) {
        const potentialScore = calculateCategoryScore(catId, diceValues);
        cell.textContent = potentialScore;
        cell.classList.add('preview');
        cell.onclick = () => {
          if (this.isAiTurn || !this.hasRolledThisTurn || this.physics.isRolling) return;
          this.recordScore(catId, potentialScore);
        };
      }
    });
  }

  clearScorePreviews() {
    Object.keys(CATEGORIES).forEach(catId => {
      const cell = document.getElementById(`score-${this.currentPlayer}-${catId}`);
      if (cell && cell.classList.contains('preview')) {
        cell.textContent = '-';
        cell.classList.remove('preview');
        cell.onclick = null;
      }
    });
  }

  // 점수 기록 확정 및 턴 전환
  recordScore(categoryId, score) {
    sound.playScoreSelect();

    this.players[this.currentPlayer].scores[categoryId] = score;

    const cell = document.getElementById(`score-${this.currentPlayer}-${categoryId}`);
    if (cell) {
      cell.textContent = score;
      cell.classList.remove('preview');
      cell.classList.add('filled');
      cell.onclick = null;
    }

    this.updateScorecardUI();

    // 전체 게임 종료 체크
    const p1Totals = calculatePlayerTotals(this.players[1].scores);
    const p2Totals = calculatePlayerTotals(this.players[2].scores);

    if (p1Totals.isFinished && p2Totals.isFinished) {
      this.handleGameOver();
      return;
    }

    // 다음 턴으로 전환
    this.switchTurn();
  }

  // 턴 전환 로직
  switchTurn() {
    this.clearScorePreviews();

    if (this.currentPlayer === 1) {
      this.currentPlayer = 2;
    } else {
      this.currentPlayer = 1;
      this.round = Math.min(this.round + 1, this.maxRounds);
    }

    this.rollsLeft = 3;
    this.hasRolledThisTurn = false;
    this.isAiTurn = (this.mode === 'ai' && this.currentPlayer === 2);

    // 킵 초기화 및 주사위 정돈
    this.physics.resetDicePositions();
    this.updateTurnInfoUI();
    this.updateKeepSlotsUI();

    if (this.isAiTurn) {
      this.setSpeech('AI가 턴을 준비하고 있습니다...');
      setTimeout(() => {
        this.runAiTurn();
      }, 900);
    } else {
      this.setSpeech(`${this.players[this.currentPlayer].name}의 차례입니다! 주사위를 굴려주세요.`);
    }
  }

  // AI 턴 진행 루틴
  runAiTurn() {
    if (!this.isAiTurn) return;

    this.setSpeech('🎲 AI가 주사위를 힘차게 던집니다!');
    this.executeRoll();
  }

  // AI가 주사위가 멈춘 후 판단
  handleAiDecision(diceValues) {
    setTimeout(() => {
      const aiScores = this.players[2].scores;

      // 굴리기 기회가 더 남아있는 경우 킵 여부 결정
      if (this.rollsLeft > 0) {
        const decision = this.ai.decideKeep(diceValues, this.rollsLeft, aiScores);
        this.setSpeech(decision.speech);

        // 킵 적용
        for (let i = 0; i < 5; i++) {
          const isKept = decision.keepIndices.includes(i);
          this.physics.setDiceKept(i, isKept);
        }
        this.updateKeepSlotsUI();

        if (decision.shouldStopRoll) {
          // 더 이상 굴리지 않고 바로 최적 점수 기록
          setTimeout(() => {
            const best = this.ai.chooseBestCategory(diceValues, aiScores);
            this.setSpeech(best.speech);
            setTimeout(() => {
              this.recordScore(best.categoryId, best.score);
            }, 800);
          }, 1000);
        } else {
          // 다음 리롤 수행
          setTimeout(() => {
            this.executeRoll();
          }, 1100);
        }
      } else {
        // 3번 모두 굴렸으므로 점수판에 기록
        const best = this.ai.chooseBestCategory(diceValues, aiScores);
        this.setSpeech(best.speech);
        setTimeout(() => {
          this.recordScore(best.categoryId, best.score);
        }, 1100);
      }
    }, 700);
  }

  // 상단 턴 정보 및 UI 갱신
  updateTurnInfoUI() {
    this.ui.roundDisplay.textContent = `${this.round} / ${this.maxRounds}`;
    this.ui.currentTurnBadge.textContent = this.players[this.currentPlayer].name;
    this.ui.currentTurnBadge.className = `turn-badge player-${this.currentPlayer}`;

    // 남은 롤 횟수 표시
    this.ui.rollsLeftDisplay.textContent = this.rollsLeft;
    this.ui.rollPins.forEach((pin, idx) => {
      pin.classList.toggle('active', idx < this.rollsLeft);
    });

    // 굴리기 버튼 상태 제어
    const canRoll = !this.isAiTurn && this.rollsLeft > 0 && !this.physics.isRolling;
    this.ui.btnRoll.disabled = !canRoll;
    if (this.rollsLeft === 3) {
      this.ui.btnRoll.innerHTML = '<span class="icon">🎲</span> 주사위 굴리기 (1회차)';
    } else if (this.rollsLeft === 2) {
      this.ui.btnRoll.innerHTML = '<span class="icon">🔄</span> 다시 굴리기 (2회차)';
    } else if (this.rollsLeft === 1) {
      this.ui.btnRoll.innerHTML = '<span class="icon">🔥</span> 마지막 굴리기 (3회차)';
    } else {
      this.ui.btnRoll.innerHTML = '<span class="icon">✅</span> 점수판을 선택하세요';
    }
  }

  // 점수판 UI 갱신 (소계, 보너스, 총점)
  updateScorecardUI() {
    [1, 2].forEach(pId => {
      const p = this.players[pId];
      const totals = calculatePlayerTotals(p.scores);

      // 상단 소계
      const upperEl = document.getElementById(`subtotal-${pId}`);
      if (upperEl) {
        upperEl.textContent = `${totals.upperSubtotal} / 63`;
      }

      // 상단 보너스
      const bonusEl = document.getElementById(`bonus-${pId}`);
      if (bonusEl) {
        if (totals.hasBonus) {
          bonusEl.textContent = `+35 (달성!)`;
          bonusEl.classList.add('bonus-earned');
        } else {
          bonusEl.textContent = `0 (남은 점수: ${totals.bonusRemaining})`;
          bonusEl.classList.remove('bonus-earned');
        }
      }

      // 하단 소계
      const lowerEl = document.getElementById(`lower-subtotal-${pId}`);
      if (lowerEl) {
        lowerEl.textContent = totals.lowerSubtotal;
      }

      // 총점
      const grandTotalEl = document.getElementById(`grand-total-${pId}`);
      if (grandTotalEl) {
        grandTotalEl.textContent = totals.grandTotal;
      }
    });

    // 현재 플레이어 점수판 열 강조
    this.ui.colPlayer1.classList.toggle('active-col', this.currentPlayer === 1);
    this.ui.colPlayer2.classList.toggle('active-col', this.currentPlayer === 2);
  }

  // 말풍선 / 안내 메시지 설정
  setSpeech(msg) {
    if (this.ui.speechBox) {
      this.ui.speechBox.textContent = msg || '';
      this.ui.speechBox.style.display = msg ? 'block' : 'none';
    }
  }

  // 게임 종료 시 모달 팝업
  handleGameOver() {
    sound.playVictory();
    this.triggerConfetti();

    const p1 = this.players[1];
    const p2 = this.players[2];
    const t1 = calculatePlayerTotals(p1.scores);
    const t2 = calculatePlayerTotals(p2.scores);

    let winnerText = '';
    if (t1.grandTotal > t2.grandTotal) {
      winnerText = `🏆 ${p1.name} 승리! 🏆`;
    } else if (t2.grandTotal > t1.grandTotal) {
      winnerText = `🏆 ${p2.name} 승리! 🏆`;
    } else {
      winnerText = '🤝 무승부! 🤝';
    }

    this.ui.gameOverTitle.textContent = winnerText;
    this.ui.gameOverDetails.innerHTML = `
      <div class="result-card">
        <div class="result-player ${t1.grandTotal >= t2.grandTotal ? 'winner' : ''}">
          <h4>${p1.name}</h4>
          <p class="final-score">${t1.grandTotal}점</p>
          <span class="sub-info">상단: ${t1.upperSubtotal}점 ${t1.hasBonus ? '(보너스 +35)' : ''}</span>
        </div>
        <div class="vs-text">VS</div>
        <div class="result-player ${t2.grandTotal >= t1.grandTotal ? 'winner' : ''}">
          <h4>${p2.name}</h4>
          <p class="final-score">${t2.grandTotal}점</p>
          <span class="sub-info">상단: ${t2.upperSubtotal}점 ${t2.hasBonus ? '(보너스 +35)' : ''}</span>
        </div>
      </div>
    `;

    this.ui.gameOverModal.classList.add('active');
  }

  // 폭죽 이펙트
  triggerConfetti() {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }
}
