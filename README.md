# 집 가 (ZipGa)

술자리 인원이 링크·QR로 한 방에 모여 미니게임을 하고, 파장 때 택시까지 이어주는 웹 앱.

**https://zip-ga-frontend.vercel.app/**

못한 사람에게 카카오T가 저절로 뜬다. 앱 이름이 그대로 벌칙 대사가 된다 — **"집 가."**

---

## 돌려보기

```bash
cd client
npm install
cp .env.example .env      # Supabase 접속 정보. 없으면 부팅 시점에 죽는다
npx expo start --web
```

```bash
npx jest                  # 테스트
npx tsc --noEmit          # 타입
```

배포는 `main`에 올라가면 Vercel이 자동으로 한다 (`client/vercel.json`).

## 폴더

```
client/           Expo 앱 (웹·안드로이드·iOS 한 코드)
  src/games/      미니게임 10종. 하나가 폴더 하나이고 서로 안 건드린다
  src/session/    세션 엔진 — 시드에서 3판 편성, 상태 머신, 점수 제출
  src/solo/       방 없이 혼자 3판
  src/screens/    화면
  src/sound/      효과음·배경음. 음원 파일 없이 코드로 합성한다
  src/room/       Supabase 연동 (방·참가자·점수·Realtime)
mdfile/           문서
```

## 문서

**처음 왔다면 [프로젝트 개요](mdfile/zipGaSummary.md)부터.**

| 문서 | 읽을 사람 |
|---|---|
| [zipGaSummary](mdfile/zipGaSummary.md) | 전체 — 무엇을 만들고 있나 |
| [zipGa](mdfile/zipGa.md) | 전체 — 무엇을 왜 이렇게 정했나 |
| [gameDev](mdfile/gameDev.md) | **미니게임 담당 — 이것만 보면 된다** |
| [frontend](mdfile/frontend.md) | 앱 골격 담당 — 화면 명세 |
| [supabase](mdfile/supabase.md) | 백엔드 담당 — 스키마·RPC 전문 |
| [backend](mdfile/backend.md) | 백엔드 담당 — 요청·확인 사항 |
| [sessionEnd](mdfile/sessionEnd.md) | 파장 흐름 결정의 근거 |
| [webDistribution](mdfile/webDistribution.md) | 웹 배포(완료)와 알림(미착수) |
| [gameRule](mdfile/gameRule.md) · [session](mdfile/session.md) | 보관용 — 다 끝난 구현 계획서 |

## 규칙 두 가지

**게임은 서로를 모른다.** 서버도 다른 플레이어도 모른 채 `seed`를 받아 문제를 만들고
점수를 돌려준다. 공정성은 시드 하나로 보장된다 — 같은 시드면 같은 문제다.
그래서 `Math.random()`을 쓰면 안 된다.

**게임 도중 통신이 0이다.** 각자 폰에서 독립 실행하고 점수만 취합한다.
