# 집 가 — 미니게임 개발 가이드

> 미니게임 하나를 맡은 사람이 읽는 문서. 이것만 보고 시작할 수 있게 쓴다.
>
> 계약의 배경은 [설계 정리](zipGa.md) §4와 [파장 흐름 설계](sessionEnd.md) §3에 있다.

## 한 줄 요약

**혼자 하는 미니게임 하나를 만들면 된다.** 서버도, 다른 플레이어도, 네트워크도 신경 쓰지 않는다.

## 시작하기

```bash
cd client
npm install
npm test
```

참조 구현은 `client/src/games/sentenceCopy/`다. **먼저 이걸 읽고 그대로 따라 하면 된다.**

## 만들 것

`client/src/games/<내-게임-id>/` 폴더 하나에 두 파일을 만든다.

| 파일 | 역할 |
|---|---|
| `logic.ts` | 순수 함수. 문제 생성, 채점, 정규화 |
| `index.tsx` | 화면. `GameModule`을 export |

로직과 화면을 나누는 이유는 **공정성 검증을 UI 없이 빠르게 돌리기 위해서**다.

폴더명과 `info.id`는 같게 한다.

## 받는 값

```ts
seed          : number   // 랜덤 시드. 모든 플레이어가 같은 값을 받는다
timeLimitSec  : number   // 이 판의 제한시간
onFinish      : (result: GameResult) => void
```

타입은 전부 `../types`에서 가져온다. **직접 정의하지 않는다** — 계약이 바뀌었을 때 컴파일 에러로 잡히지 않는다.

```ts
import type { GameModule, GameProps, GameResult } from '../types'
```

## 돌려주는 값

```ts
normalizedScore : number   // 0~100. 항상 높을수록 좋음 — 벌칙 판정에 쓰이는 유일한 값
score           : number   // 원점수. 화면 표시 전용 ("18/20문제")
tiebreakMs      : number   // 걸린 시간(ms). 동점 판별용 — 작을수록 유리
finished        : boolean  // 완주 여부
```

## 규칙 다섯 가지

### 1. `Math.random()`을 쓰지 않는다

무조건 `createRng(seed)`를 쓴다.

```ts
import { createRng } from '../prng'

const rng = createRng(seed)
const value = rng.int(2, 9)          // 2~9 정수
const shuffled = rng.shuffle(cards)  // 원본을 건드리지 않고 섞은 새 배열
```

폰마다 다른 문제가 나오면 **"쟤는 쉬운 거 나왔다"**는 분쟁이 생긴다. 이 앱에서 제일 중요한 규칙이다.

### 2. `normalizedScore`는 0~100이고 높을수록 좋다

| 게임 유형 | 매핑 |
|---|---|
| 개수형 (구구단 20문제) | `맞힌 수 / 전체 수 × 100` |
| 시간형 (빨리 끝낼수록 좋음) | 목표 시간을 잡고 `목표 / 걸린시간 × 100` |
| 실패형 (실수 횟수) | `(1 − 실수/허용치) × 100` |

마지막에 반드시 `Math.min(100, Math.max(0, x))`로 자른다.

> **"잘하는 사람이 대략 100, 전혀 못 한 사람이 대략 0"**이 되도록 맞춘다. 기준선은 앱 전역에서 40점 하나뿐이라, 밸런스가 어긋나면 기준선이 아니라 **이 식을 고친다.**

### 3. 제한시간이 끝나면 스스로 종료한다

시계는 **하나만** 둔다. 마운트할 때 `deadline`을 고정하고 남은 시간은 거기서 계산한다.

```ts
const deadlineRef = useRef(Date.now() + timeLimitSec * 1000)
```

> ⚠️ `setInterval`로 1초씩 빼는 방식은 쓰지 않는다. 앱이 백그라운드로 가면 JS 타이머가 멈춰서 **폰을 엎어놨다 켠 사람이 시간을 더 쓴다.** 시드로 막은 공정성이 타이머에서 다시 깨진다.

### 4. 시간 초과여도 그때까지의 점수를 반환한다

**0점으로 처리하면 안 된다.** 3판 평균이 40점 미만이면 그 사람은 집에 가야 하므로, 부당한 0점은 억울한 강퇴가 된다.

`finished`는 **"스스로 정상 종료했는가"**다. 게임 성격에 따라 갈린다.

| 상황 | `finished` |
|---|---|
| 문제를 다 풀어서 끝남 | `true` |
| 시간을 채우는 게임(문장 따라 쓰기)에서 시간 만료 | `true` — 이게 정상 종료다 |
| 문제 수가 정해진 게임(구구단 20문제)에서 시간 만료 | `false` — 완주하지 못했다 |
| 중도 이탈 (화면 언마운트) | `false` |

호스트도 **제한시간이 지나도 모듈이 반환하지 않으면** 강제 종료하고 `finished: false`로 제출한다([프론트엔드 화면 명세](frontend.md) §S6). 같은 의미로 쓴다.

### 5. `onFinish`는 정확히 한 번만 부른다

완주와 시간 만료가 겹치면 중복 호출이 난다. `useRef` 플래그로 막는다.

```ts
const finishedRef = useRef(false)

const finish = (completed: boolean) => {
  if (finishedRef.current) return
  finishedRef.current = true
  onFinish({ /* ... */ })
}
```

## 등록하기

`client/src/games/registry.ts`에 두 줄만 추가한다. **여기가 유일한 공유 지점이다.**

```ts
import { myGame } from './myGame'

export const GAMES: readonly GameModule[] = [sentenceCopy, myGame]
```

충돌은 이 한 줄에서만 난다. 나머지는 전부 자기 폴더 안이다.

## 제출 전 체크리스트

- [ ] 모든 무작위 요소를 `seed`에서 파생시켰는가 (`Math.random()` 0회)
- [ ] 타입을 `../types`에서 import 했는가 (직접 정의 금지)
- [ ] `normalizedScore`가 0~100 범위이고, 높을수록 좋은 방향인가
- [ ] 시간·실패 기반 게임이라면 뒤집어서 반환했는가
- [ ] 제한시간이 끝나면 스스로 종료하고 점수를 반환하는가
- [ ] 시간 초과 시에도 그때까지의 점수를 반환하는가 (0점 처리 금지)
- [ ] 타이머를 `deadline` 기준으로 계산했는가 (틱 카운트 금지)
- [ ] `onFinish`를 정확히 한 번만 부르는가
- [ ] 네트워크 코드가 없는가
- [ ] `registry.ts`에 등록했는가

## 반드시 써야 할 테스트

테스트는 `client/src/games/__tests__/`에 `<내-게임-id>-logic.test.ts`, `<내-게임-id>-ui.test.tsx`로 둔다.
참조 구현의 `sentenceCopy-logic.test.ts`를 그대로 베껴서 자기 게임에 맞게 고친다. 최소 이 네 가지는 있어야 한다.

```ts
it('같은 시드는 완전히 같은 문제를 만든다', () => {
  expect(makeQuestions(31337)).toEqual(makeQuestions(31337))
})

it('다른 시드는 다른 문제를 만든다', () => {
  expect(makeQuestions(1)).not.toEqual(makeQuestions(2))
})

it('시간 초과여도 그때까지 맞힌 점수를 반환한다', () => {
  // sentenceCopy-ui.test.tsx 참고
})

it('어떤 입력에도 계약을 위반하지 않는다', () => {
  // validateGameResult(result, '내-게임-id')가 빈 배열이어야 한다
  expect(validateGameResult(result, 'myGame')).toEqual([])
})
```

마지막 것이 제일 중요하다. `validateGameResult`는 `../types`에 있고, 범위를 벗어난 `normalizedScore`나 `NaN`을 즉시 잡아낸다.

## 게임 성격에 대한 제약

**밀리초 단위 실시간 판정이 필요한 게임은 만들지 않는다.** 각 폰이 독립 실행하므로 반응속도 대결 같은 건 공정하게 겨룰 수 없다. 전부 "느긋한" 성격이어야 한다.
