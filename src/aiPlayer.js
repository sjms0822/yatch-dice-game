import { calculateCategoryScore, CATEGORIES, UPPER_CATEGORIES, LOWER_CATEGORIES } from './yachtRules.js';

export class YachtAI {
  constructor(name = '인공지능') {
    this.name = name;
  }

  /**
   * 리롤을 위해 어떤 주사위를 킵(Keep)할지 결정
   * @param {number[]} dice - 현재 5개 주사위 눈금 [d1, d2, d3, d4, d5]
   * @param {number} rollsLeft - 남은 굴리기 기회 (2 or 1)
   * @param {Object} aiScores - 현재 AI 점수판 상태
   * @returns {{ keepIndices: number[], speech: string, shouldStopRoll: boolean }}
   */
  decideKeep(dice, rollsLeft, aiScores) {
    const counts = {};
    for (let i = 1; i <= 6; i++) counts[i] = [];
    dice.forEach((val, idx) => {
      counts[val].push(idx);
    });

    const isAvailable = (cat) => aiScores[cat] === null || aiScores[cat] === undefined;

    // 1. 요트(5개 동일)가 완성된 경우
    for (let num = 1; num <= 6; num++) {
      if (counts[num].length === 5) {
        if (isAvailable('yacht')) {
          return {
            keepIndices: [0, 1, 2, 3, 4],
            speech: '대박! 요트(Yacht)가 바로 나왔어! 50점 확정!',
            shouldStopRoll: true
          };
        }
      }
    }

    // 2. 라지 스트레이트 완성된 경우
    if (isAvailable('largeStraight') && calculateCategoryScore('largeStraight', dice) === 30) {
      return {
        keepIndices: [0, 1, 2, 3, 4],
        speech: '라지 스트레이트 완성! 안전하게 30점 챙길게.',
        shouldStopRoll: true
      };
    }

    // 3. 4개 동일 (Four of a Kind)
    for (let num = 1; num <= 6; num++) {
      if (counts[num].length === 4) {
        if (isAvailable('yacht') && rollsLeft > 0) {
          return {
            keepIndices: counts[num],
            speech: `${num}이(가) 4개! 마지막 하나로 요트(50점)를 노려본다!`,
            shouldStopRoll: false
          };
        } else if (isAvailable('fourOfAKind')) {
          return {
            keepIndices: [0, 1, 2, 3, 4],
            speech: '4 오브 어 카인드 만족! 킵해둘게.',
            shouldStopRoll: false
          };
        }
      }
    }

    // 4. 풀하우스(3개 + 2개) 완성된 경우
    const tripleNum = Object.keys(counts).find(n => counts[n].length === 3);
    const pairNum = Object.keys(counts).find(n => counts[n].length === 2);
    if (tripleNum && pairNum && isAvailable('fullHouse')) {
      const fhScore = calculateCategoryScore('fullHouse', dice);
      return {
        keepIndices: [0, 1, 2, 3, 4],
        speech: `풀하우스 완성! 5개 총합 ${fhScore}점 확보!`,
        shouldStopRoll: true
      };
    }

    // 5. 스몰 스트레이트(4개 연속) 체크
    const uniqueVals = Array.from(new Set(dice)).sort((a, b) => a - b);
    const uniqueStr = uniqueVals.join('');
    let straightPattern = null;
    if (uniqueStr.includes('1234')) straightPattern = [1, 2, 3, 4];
    else if (uniqueStr.includes('2345')) straightPattern = [2, 3, 4, 5];
    else if (uniqueStr.includes('3456')) straightPattern = [3, 4, 5, 6];

    if (straightPattern) {
      // 패턴에 해당하는 인덱스 4개 추출
      const keepIndices = [];
      for (const val of straightPattern) {
        const idx = dice.indexOf(val);
        if (idx !== -1 && !keepIndices.includes(idx)) {
          keepIndices.push(idx);
        }
      }

      if (isAvailable('largeStraight') && rollsLeft > 0) {
        return {
          keepIndices,
          speech: '스몰 스트레이트 확보! 남은 1개로 라지 스트레이트(30점)를 노려볼까?',
          shouldStopRoll: false
        };
      } else if (isAvailable('smallStraight')) {
        return {
          keepIndices,
          speech: '스몰 스트레이트 15점 지키기!',
          shouldStopRoll: false
        };
      }
    }

    // 6. 3개 동일(트리플)인 경우
    if (tripleNum) {
      const num = parseInt(tripleNum, 10);
      const tripleIndices = counts[num];
      // 4, 5, 6의 경우 상단 보너스 및 포카인드 노리기
      if (isAvailable('fourOfAKind') || isAvailable('yacht') || (num >= 4 && isAvailable(this.getUpperCatId(num)))) {
        return {
          keepIndices: tripleIndices,
          speech: `${num} 3개 발견! 더 큰 조합이나 상단 점수를 노린다.`,
          shouldStopRoll: false
        };
      }
    }

    // 7. 연속 3개 숫자 (스트레이트 빌드업)
    const subsets = [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6]];
    if ((isAvailable('smallStraight') || isAvailable('largeStraight')) && rollsLeft >= 1) {
      for (const sub of subsets) {
        if (sub.every(v => uniqueVals.includes(v))) {
          const keepIndices = [];
          for (const v of sub) {
            const idx = dice.findIndex((val, i) => val === v && !keepIndices.includes(i));
            if (idx !== -1) keepIndices.push(idx);
          }
          return {
            keepIndices,
            speech: `연속된 숫자(${sub.join('-')}) 발견! 스트레이트를 완성해볼게.`,
            shouldStopRoll: false
          };
        }
      }
    }

    // 8. 2개 페어 (상단 6, 5, 4 우선 킵)
    for (const num of [6, 5, 4]) {
      if (counts[num].length >= 2 && isAvailable(this.getUpperCatId(num))) {
        return {
          keepIndices: counts[num],
          speech: `상단 보너스를 위해 ${num} 페어를 모아둘게!`,
          shouldStopRoll: false
        };
      }
    }

    // 9. 가장 빈도가 높은 주사위 페어 킵
    let maxNum = 1;
    let maxLen = 0;
    for (let num = 6; num >= 1; num--) {
      if (counts[num].length > maxLen) {
        maxLen = counts[num].length;
        maxNum = num;
      }
    }

    if (maxLen >= 2) {
      return {
        keepIndices: counts[maxNum],
        speech: `${maxNum} 페어를 지키고 다시 굴려보자.`,
        shouldStopRoll: false
      };
    }

    // 10. 딱히 좋은 게 없다면 높은 눈 1~2개(5, 6) 킵하거나 전체 리롤
    const highIndices = [];
    dice.forEach((val, idx) => {
      if (val >= 5) highIndices.push(idx);
    });

    if (highIndices.length > 0) {
      return {
        keepIndices: highIndices,
        speech: '높은 눈금만 남겨두고 시원하게 다시 던진다!',
        shouldStopRoll: false
      };
    }

    return {
      keepIndices: [],
      speech: '마음에 드는 게 없네. 5개 전부 다시 굴린다!',
      shouldStopRoll: false
    };
  }

  /**
   * 주사위 굴리기가 모두 끝났을 때 점수판에 기록할 최적의 슬롯 선택
   * @param {number[]} dice - 최종 주사위 5개
   * @param {Object} aiScores - AI의 현재 점수표
   * @returns {{ categoryId: string, score: number, speech: string }}
   */
  chooseBestCategory(dice, aiScores) {
    const isAvailable = (cat) => aiScores[cat] === null || aiScores[cat] === undefined;

    // 비어있는 카테고리 후보군
    const availableCategories = Object.keys(CATEGORIES).filter(isAvailable);
    if (availableCategories.length === 0) return null;

    // 각 카테고리별 잠재적 점수 및 가치 평가
    const candidates = availableCategories.map(cat => {
      const score = calculateCategoryScore(cat, dice);
      let weight = score;

      // 가치 평가 튜닝
      if (cat === 'yacht' && score === 50) weight += 100;
      if (cat === 'largeStraight' && score === 30) weight += 45;
      if (cat === 'smallStraight' && score === 15) weight += 20;
      if (cat === 'fullHouse' && score > 0) weight += 25;

      // 상단 섹션 보너스(63점) 기여도 평가
      if (UPPER_CATEGORIES.includes(cat)) {
        const target = CATEGORIES[cat].targetNum;
        const expectedAverage = target * 3; // 3개 이상이면 보너스 페이스
        if (score >= expectedAverage) {
          weight += 15 + (score - expectedAverage) * 3;
        } else if (score === 0) {
          // 0점을 넣는 경우: 에이스(1)는 0점 처리해도 손실이 가장 적음 (-5), 6은 치명적 (-40)
          weight -= (target * 6);
        }
      }

      // Choice에 낮은 점수 넣는 것 방지 (Choice는 20점 이상일 때 좋음)
      if (cat === 'choice') {
        if (score < 18) weight -= 15;
      }

      // 4-of-a-Kind에 0점 처리하는 경우
      if (cat === 'fourOfAKind' && score === 0) {
        weight -= 20;
      }

      return { categoryId: cat, score, weight };
    });

    // 점수가 0점보다 큰 것 중 최선 선택
    const scoringPositive = candidates.filter(c => c.score > 0);
    if (scoringPositive.length > 0) {
      scoringPositive.sort((a, b) => b.weight - a.weight);
      const best = scoringPositive[0];
      const catInfo = CATEGORIES[best.categoryId];

      let speech = `${catInfo.name}에 ${best.score}점 기록!`;
      if (best.categoryId === 'yacht') speech = '축제다! 요트 50점 획득!';
      else if (best.categoryId === 'largeStraight') speech = '라지 스트레이트 30점 나이스!';
      else if (best.score >= 25) speech = `${catInfo.name}에 ${best.score}점! 아주 훌륭해.`;

      return {
        categoryId: best.categoryId,
        score: best.score,
        speech
      };
    }

    // 어쩔 수 없이 0점을 기록해야 하는 경우 (희생 슬롯 결정)
    // 에이스(Aces) > 듀스(Deuces) > 요트(최후순위) 순으로 피해 최소화
    const sacrificePriority = ['aces', 'deuces', 'threes', 'fourOfAKind', 'choice', 'fullHouse', 'smallStraight', 'fours', 'fives', 'largeStraight', 'sixes', 'yacht'];
    for (const cat of sacrificePriority) {
      if (isAvailable(cat)) {
        const catInfo = CATEGORIES[cat];
        return {
          categoryId: cat,
          score: 0,
          speech: `아쉽지만 이번엔 ${catInfo.name}에 0점을 적어야겠어.`
        };
      }
    }

    // fallback
    const fallback = candidates[0];
    return {
      categoryId: fallback.categoryId,
      score: fallback.score,
      speech: `${CATEGORIES[fallback.categoryId].name}에 기록합니다.`
    };
  }

  getUpperCatId(num) {
    const map = { 1: 'aces', 2: 'deuces', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes' };
    return map[num];
  }
}
