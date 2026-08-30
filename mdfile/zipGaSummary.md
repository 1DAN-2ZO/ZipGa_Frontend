# 집 가 (ZipGa) — 프로젝트 개요

술자리 인원이 링크·QR로 한 방에 모여 미니게임을 하고, 파장 때 택시까지 이어주는 웹 앱.

**지금 여기서 돌아갑니다 → https://zip-ga-frontend.vercel.app/**

설치가 필요 없다. 링크를 받은 사람은 브라우저에서 바로 들어온다. 안드로이드·iOS를 가리지 않는다.

---

## 어떻게 노는가

```
방장이 링크·QR 공유  →  다들 눌러서 입장
                        ↓
                  로비에서 대기
                        ↓
        30분마다 "게임할 시간!" 배지가 뜸
        방장이 시작을 누름 (게임 선택 없음)
                        ↓
        랜덤 게임 3개가 공개되고 연속으로 진행
                        ↓
              3판 평균 점수 발표
                        ↓
        40점 미만인 사람 → "집 가" → 카카오T 실행
                        ↓
              나머지는 로비로, 다음 판 대기
```

술자리가 끝날 때까지 이 루프가 반복된다.

**혼자서도 된다.** 홈에서 바로 3판을 돌려볼 수 있다(솔로). 방도 서버도 없이 진행되므로 게임을 미리 익히거나 사람이 모이기 전에 시간을 때우는 용도다.

## 핵심 아이디어 세 가지

**1. 벌칙이 곧 귀가다**

못한 사람에게 카카오T가 저절로 뜬다. 앱 이름이 그대로 벌칙 대사가 된다 — **"집 가."** 카카오T 연동이 부록이 아니라 핵심 루프다.

**2. 절대평가라 술자리 후반에 사람이 빠진다**

꼴찌가 아니라 **3판 평균 40점 미만**이 벌칙 대상이다. 취할수록 점수가 떨어지므로 초반엔 아무도 안 걸리다가 후반에 자연스럽게 벌칙이 늘어난다. 파장 곡선이 규칙에서 저절로 나온다.

1등도 미달이면 벌칙이고, 전원 미달이면 다 같이 집에 간다.

**3. 게임 중에는 통신이 0이다**

각자 폰에서 독립 실행하고 **점수만 취합**한다. 공정성은 서버가 뿌린 **시드** 하나로 보장한다 — 같은 시드에서 같은 문제가 나오므로 모두 같은 조건이다.

덕분에 게임 만드는 사람은 네트워크를 몰라도 된다. 혼자 하는 미니게임 하나 만드는 것과 같다.

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 앱 | React Native (Expo) + TypeScript | `react-native-web`으로 웹까지 한 코드 |
| 배포 | Vercel (`npx expo export -p web`) | 정적 파일. 서버 프로세스 없음 |
| 서버 | Supabase (Postgres + Realtime + 익명 Auth) | 서버 코드 없음. SQL이 전부 |
| 입장 | 링크·QR → `/room/{코드}` | 코드 직접 입력 폴백. 네이티브는 `jipga://room/{코드}` |
| 택시 | 카카오T `kakaot://` | 실기기 검증 완료 |
| 소리 | Web Audio로 코드 합성 | 음원 파일 0개 |
| 계측 | Vercel Web Analytics | |

**Edge Function 0개, 서버 타이머 0개.** 모든 시간 판정은 서버가 준 시각을 기준으로 클라이언트가 계산한다. cron도 스케줄러도 없어서 서버 관리 부담이 사실상 없다.

## 규칙 요약

| 항목 | 값 |
|---|---|
| 한 세션 | 랜덤 3판 연속 |
| 세션 주기 | 방장 설정 30~60분 (기본 30분) |
| 방 수명 | TTL 2시간, 활동 시 연장. 인원 0이면 삭제 |
| 벌칙 기준 | 3판 평균 `normalizedScore < 40` |
| 벌칙 내용 | 카카오T 실행 + 방에서 강퇴 |
| 재입장 | 허용, 횟수 제한 없음 |
| 미니게임 | 총 10개 예정 |

### 문구 (바꾸지 말 것)

| 상황 | 문구 | 어조 |
|---|---|---|
| 벌칙 (타의) | **집 가** | 명령형 — 앱이 나에게 |
| 자발 귀가 (자의) | **집에 갈래** | 의지형 — 내가 앱에게 |
| 재입장 (자의) | **아직 안 갈래** | 의지형 (부정) |

자발적인 두 버튼이 `-ㄹ래`로 짝을 이루고 벌칙만 명령형으로 떨어져 나온다. 문구만 봐도 내 의지인지 앱이 시킨 것인지 구분된다.

## 역할 분담

| 영역 | 하는 일 | 상태 |
|---|---|---|
| 앱 골격 | Expo 초기화, 네비게이션, Supabase 연결, 홈·QR·로비 | 진행 중 |
| 백엔드 | 스키마 4개, RLS, RPC 9개 | 진행 중 |
| 미니게임 | 게임 모듈 (1인 1개 이상) | 2명 진행 중 |
| 통합 | 세션 엔진, 게임 호스트, 파장·딥링크 | 대기 (선행 작업 필요) |

### 폴더 경계

같은 저장소에서 동시에 작업해도 충돌하지 않도록 폴더로 나눈다.

```
client/src/
├─ screens/     앱 골격 담당
├─ lib/         앱 골격 담당 (supabase 초기화)
├─ games/       게임 계약 + 미니게임들
└─ session/     통합 담당 (세션 엔진)
```

공유되는 파일은 `games/registry.ts` 하나뿐이다. 게임 추가는 import 한 줄 + 배열 한 줄이라 충돌해도 금방 풀린다.

## 진행 상황

**웹으로 배포되어 실제로 돌아가고 있다.** 스토어 출시 대신 웹을 택했다 — 술자리에서 앱을 깔게 만드는 것 자체가 가장 큰 이탈 지점이었다.

- [x] 설계 확정 (파장 흐름, 벌칙, 세션 구조)
- [x] 카카오T 딥링크 실기기 검증 — `kakaot://` 확정
- [x] 문서화 (설계·프론트·백엔드·구현 계획)
- [x] Expo 프로젝트 초기화
- [x] 백엔드 스키마 · RLS · RPC (`server_now()` 포함)
- [x] 게임 계약 구현 (`types` `prng` `registry`)
- [x] 세션 엔진
- [x] 화면 구현
- [x] 파장 · 딥링크
- [x] 미니게임 10개
- [x] 솔로 모드 (방 없이 혼자 3판)
- [x] 효과음 · 배경음
- [x] 웹 배포 (Vercel)
- [ ] 알림 — 인앱 복귀 동기화 · Web Push ([webDistribution](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/webDistribution.md) §C·§D)
- [ ] 실사용 테스트 후 게임별 난이도 조정

## 문서

저장소: https://github.com/1DAN-2ZO/ZipGa_Frontend

| 문서 | 읽을 사람 |
|---|---|
| [zipGa](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/zipGa.md) | 전체 — 무엇을 왜 이렇게 정했나 |
| [frontend](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/frontend.md) | 앱 골격 담당 — 화면 명세 |
| [supabase](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/supabase.md) | 백엔드 담당 — 스키마·RPC 전문 |
| [backend](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/backend.md) | 백엔드 담당 — 요청·확인 사항 |
| [gameDev](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/gameDev.md) | **미니게임 담당 — 이것만 보면 된다** |
| [sessionEnd](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/sessionEnd.md) | 전체 — 파장 흐름 결정의 근거 |
| [webDistribution](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/webDistribution.md) | 웹 배포와 알림. §A 배포는 완료, §C·§D 알림은 미착수 |
| [gameRule](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/gameRule.md) · [session](https://github.com/1DAN-2ZO/ZipGa_Frontend/blob/main/mdfile/session.md) | 보관용 — 다 끝난 구현 계획서 |

**미니게임 담당자는** 설계 정리의 §4 게임 모듈 규격만 보면 된다. 받는 값 2개, 돌려주는 값 4개가 계약의 전부다.

## 아직 안 정한 것

| 항목 | 상태 |
|---|---|
| 알림 | 설계만 있고 미구현. 세션 시작을 놓치면 0점으로 강퇴되므로 우선순위가 높다 |
| 게임별 난이도 | 실사용하며 계속 조정 중. 통과 문턱이 게임마다 다르다 |
| 세션당 판수 | 현재 3판 |
| 세션 최소 인원 | 2명 |
| 닉네임 중복 처리 | 현재 허용. 화면에서 헷갈릴 수 있음 |
| 누적 통계 / 역대 랭킹 | 현 설계에는 없음. 방이 사라지면 기록도 사라짐 |
