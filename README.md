# HRI MVP — Human Rhythm Intelligence

> 지금, 당신의 마음을 살펴보세요  
> https://human-rhythm.com

---

## 폴더 구조

```
hri-mvp/
├── public/
│   └── assets/
│       └── header.png          ← 헤더 이미지 여기 넣기
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← 루트 레이아웃 (메타데이터, 폰트)
│   │   ├── page.tsx            ← 진입점 (HriSession 마운트)
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts    ← FastAPI 프록시 (나중에 활성화)
│   │
│   ├── components/
│   │   ├── HriSession.tsx      ← 전체 세션 상태 관리
│   │   ├── HriInput.tsx        ← 입력창 (서비스의 주인공)
│   │   └── ThinkingDots.tsx    ← 로딩 인디케이터
│   │
│   ├── lib/
│   │   ├── questionEngine.ts   ← 질문 로직 (내부 IP 위치)
│   │   └── api.ts              ← Backend 연결 클라이언트
│   │
│   └── styles/
│       └── globals.css         ← 전체 스타일
│
├── .env.example                ← 환경변수 템플릿
├── vercel.json                 ← Vercel 배포 설정
└── next.config.js
```

---

## 로컬 실행

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## 헤더 이미지 넣기

```
public/assets/header.png   ← 이 경로에 헤더 이미지 파일 복사
```

이미지 권장 사이즈: 1440×320px (2x 레티나 기준: 720×160px)

---

## 질문 로직 수정

`src/lib/questionEngine.ts` 파일에서:

- `TURN_1_QUESTIONS` 배열 → Turn 1 질문 목록 교체
- `TURN_2_QUESTIONS` 배열 → Turn 2 질문 목록 교체
- `generateReflection()` 함수 → 리플렉션 생성 로직 교체

UI 코드는 전혀 수정하지 않아도 됩니다.

---

## Vercel 배포 순서

### 1단계 — 레포 준비

```bash
git init
git add .
git commit -m "HRI MVP initial"
git remote add origin https://github.com/YOUR_ORG/hri-mvp.git
git push -u origin main
```

### 2단계 — Vercel 연결

1. https://vercel.com → New Project
2. GitHub 레포 선택
3. Framework: Next.js (자동 감지)
4. Root Directory: `./` (기본값)
5. Deploy 클릭

### 3단계 — 환경변수 (선택)

Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL   (비워두면 로컬 엔진 사용)
FASTAPI_URL           (FastAPI 서버 URL, 나중에 설정)
```

### 4단계 — 도메인 연결

Vercel Dashboard → Settings → Domains:
- `human-rhythm.com` 추가
- DNS CNAME: `cname.vercel-dns.com`

---

## FastAPI 백엔드 연결 (나중에)

1. `.env.local` 에서 `NEXT_PUBLIC_API_URL` 설정
2. FastAPI에 `POST /analyze` 엔드포인트 구현
3. 요청 형식: `{ turn: number, inputs: string[] }`
4. 응답 형식: `{ question?: string, reflection?: string, isDone: boolean }`

---

## MVP 오픈 전 체크리스트

### 필수
- [ ] `public/assets/header.png` 이미지 파일 있음
- [ ] `npm run build` 에러 없이 완료
- [ ] 로컬에서 3턴 플로우 (입력→질문→입력→질문→입력→리플렉션) 확인
- [ ] 모바일 화면에서 입력창 정상 작동
- [ ] Enter 제출 동작 확인
- [ ] Vercel 배포 완료

### 권장
- [ ] `src/lib/questionEngine.ts` 실제 질문/리플렉션 로직 교체
- [ ] `public/favicon.ico` 추가
- [ ] Vercel Analytics 활성화
- [ ] 도메인 연결 완료

### 나중에
- [ ] FastAPI 백엔드 연결
- [ ] 세션 저장 (서버 or localStorage)
- [ ] 언어 선택 (ko/en)
- [ ] ADI 엔진 연동
