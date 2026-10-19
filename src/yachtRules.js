// Yacht Dice Official Rules and Scoring Engine

export const CATEGORIES = {
  // Upper Section
  aces: { id: 'aces', name: '에이스 (Aces)', section: 'upper', targetNum: 1, desc: '1의 눈의 총합' },
  deuces: { id: 'deuces', name: '듀스 (Deuces)', section: 'upper', targetNum: 2, desc: '2의 눈의 총합' },
  threes: { id: 'threes', name: '트레이 (Threes)', section: 'upper', targetNum: 3, desc: '3의 눈의 총합' },
  fours: { id: 'fours', name: '포 (Fours)', section: 'upper', targetNum: 4, desc: '4의 눈의 총합' },
  fives: { id: 'fives', name: '파이브 (Fives)', section: 'upper', targetNum: 5, desc: '5의 눈의 총합' },
  sixes: { id: 'sixes', name: '식스 (Sixes)', section: 'upper', targetNum: 6, desc: '6의 눈의 총합' },
  
  // Lower Section
  choice: { id: 'choice', name: '초이스 (Choice)', section: 'lower', desc: '주사위 5개의 총합 (조건 없음)' },
  fourOfAKind: { id: 'fourOfAKind', name: '4 오브 어 카인드', section: 'lower', desc: '같은 눈 4개 이상 시 5개 주사위의 총합' },
  fullHouse: { id: 'fullHouse', name: '풀하우스 (Full House)', section: 'lower', desc: '같은 눈 3개 + 2개 조합 시 5개 주사위의 총합' },
  smallStraight: { id: 'smallStraight', name: '스몰 스트레이트 (S.Straight)', section: 'lower', desc: '연속된 4개 숫자 조합 시 고정 15점' },
  largeStraight: { id: 'largeStraight', name: '라지 스트레이트 (L.Straight)', section: 'lower', desc: '연속된 5개 숫자 조합 시 고정 30점' },
  yacht: { id: 'yacht', name: '요트 (Yacht)', section: 'lower', desc: '동일한 눈 5개 조합 시 고정 50점' }
};

export const UPPER_CATEGORIES = ['aces', 'deuces', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER_CATEGORIES = ['choice', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht'];
export const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_SCORE = 35;

/**
 * 주사위 5개 배열 [d1, d2, d3, d4, d5]에 대해 특정 카테고리의 획득 가능 점수를 계산
 */
export function calculateCategoryScore(categoryId, dice) {
  if (!dice || dice.length !== 5) return 0;
  
  const sum = dice.reduce((acc, v) => acc + v, 0);
  
  // 눈금별 출현 빈도수 계산
  const counts = {};
  for (let d = 1; d <= 6; d++) counts[d] = 0;
  for (const d of dice) {
    counts[d] = (counts[d] || 0) + 1;
  }
  const countValues = Object.values(counts);

  switch (categoryId) {
    // Upper Section
    case 'aces':
      return (counts[1] || 0) * 1;
    case 'deuces':
      return (counts[2] || 0) * 2;
    case 'threes':
      return (counts[3] || 0) * 3;
    case 'fours':
      return (counts[4] || 0) * 4;
    case 'fives':
      return (counts[5] || 0) * 5;
    case 'sixes':
      return (counts[6] || 0) * 6;

    // Lower Section
    case 'choice':
      return sum;

    case 'fourOfAKind':
      // 같은 눈이 4개 이상 시 주사위 5개의 합
      if (countValues.some(cnt => cnt >= 4)) {
        return sum;
      }
      return 0;

    case 'fullHouse':
      // 3개 + 2개 또는 5개 모두 동일 시 주사위 5개의 합
      const hasThree = countValues.includes(3);
      const hasTwo = countValues.includes(2);
      const hasFive = countValues.includes(5);
      if ((hasThree && hasTwo) || hasFive) {
        return sum;
      }
      return 0;

    case 'smallStraight': {
      // 4개 연속: 1-2-3-4, 2-3-4-5, 3-4-5-6 시 고정 15점
      const uniqueSorted = Array.from(new Set(dice)).sort((a, b) => a - b);
      const str = uniqueSorted.join('');
      if (str.includes('1234') || str.includes('2345') || str.includes('3456')) {
        return 15;
      }
      return 0;
    }

    case 'largeStraight': {
      // 5개 연속: 1-2-3-4-5 또는 2-3-4-5-6 시 고정 30점
      const sorted = [...dice].sort((a, b) => a - b).join('');
      if (sorted === '12345' || sorted === '23456') {
        return 30;
      }
      return 0;
    }

    case 'yacht':
      // 5개 모두 동일
      if (countValues.includes(5)) {
        return 50;
      }
      return 0;

    default:
      return 0;
  }
}

/**
 * 플레이어의 점수표 계산 (상단 소계, 보너스, 총점)
 */
export function calculatePlayerTotals(scores) {
  let upperSubtotal = 0;
  let upperFilledCount = 0;
  
  for (const cat of UPPER_CATEGORIES) {
    if (scores[cat] !== null && scores[cat] !== undefined) {
      upperSubtotal += scores[cat];
      upperFilledCount++;
    }
  }

  const hasBonus = upperSubtotal >= UPPER_BONUS_THRESHOLD;
  const bonusScore = hasBonus ? UPPER_BONUS_SCORE : 0;

  let lowerSubtotal = 0;
  let lowerFilledCount = 0;
  for (const cat of LOWER_CATEGORIES) {
    if (scores[cat] !== null && scores[cat] !== undefined) {
      lowerSubtotal += scores[cat];
      lowerFilledCount++;
    }
  }

  const grandTotal = upperSubtotal + bonusScore + lowerSubtotal;
  const isFinished = (upperFilledCount + lowerFilledCount) === ALL_CATEGORIES.length;

  return {
    upperSubtotal,
    bonusScore,
    hasBonus,
    bonusRemaining: Math.max(0, UPPER_BONUS_THRESHOLD - upperSubtotal),
    lowerSubtotal,
    grandTotal,
    filledCount: upperFilledCount + lowerFilledCount,
    isFinished
  };
}

/**
 * 초기 비어있는 플레이어 점수판 생성
 */
export function createEmptyScores() {
  const scores = {};
  for (const cat of ALL_CATEGORIES) {
    scores[cat] = null;
  }
  return scores;
}
