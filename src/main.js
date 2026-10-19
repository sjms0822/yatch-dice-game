import { PhysicsDiceScene } from './physicsScene.js';
import { GameController } from './gameController.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('dice-canvas-container');

  // UI 요소 바인딩
  const uiElements = {
    btnRoll: document.getElementById('btn-roll'),
    btnModeAi: document.getElementById('btn-mode-ai'),
    btnModePvp: document.getElementById('btn-mode-pvp'),
    btnRestart: document.getElementById('btn-restart'),
    btnMute: document.getElementById('btn-mute'),
    btnHelp: document.getElementById('btn-help'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnPlayAgain: document.getElementById('btn-play-again'),

    roundDisplay: document.getElementById('round-display'),
    currentTurnBadge: document.getElementById('current-turn-badge'),
    speechBox: document.getElementById('speech-box'),

    rollsLeftDisplay: document.getElementById('rolls-left-display'),
    rollPins: document.querySelectorAll('.roll-pin'),
    keepSlots: document.querySelectorAll('.keep-slot'),

    player1HeaderName: document.getElementById('player1-header-name'),
    player2HeaderName: document.getElementById('player2-header-name'),
    colPlayer1: document.getElementById('col-player1'),
    colPlayer2: document.getElementById('col-player2'),

    rulesModal: document.getElementById('rules-modal'),
    gameOverModal: document.getElementById('game-over-modal'),
    gameOverTitle: document.getElementById('game-over-title'),
    gameOverDetails: document.getElementById('game-over-details'),
  };

  // 3D 물리 씬 초기화
  const physicsScene = new PhysicsDiceScene(container, null, null);

  // 게임 컨트롤러 초기화
  const controller = new GameController(physicsScene, uiElements);

  // 전역 디버깅 접근 지원 (필요 시)
  window.__yachtGame = controller;
});
