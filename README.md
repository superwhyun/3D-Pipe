# 3D Pipe: GLB to FBX Serverless Converter

이 프로젝트는 GLB 파일을 FBX로 변환해주는 서버리스 웹 서비스입니다. RunPod와 Blender를 사용하여 고품질의 3D 모델 변환을 제공하며, 프론트엔드에서 여러 파일의 순차 처리를 지원합니다.

## 프로젝트 구조

```
3Dpipe/
├── docker-compose.yml  # 로컬 백엔드 실행용 Compose 파일
├── backend/            # Blender 변환 로직 및 도커 설정
│   ├── Dockerfile      # RunPod용 컨테이너 설정
│   ├── converter.py    # Blender 파이썬 변환 스크립트
│   └── handler.py      # RunPod Serverless 핸들러
└── ui/                 # Next.js 프론트엔드 웹 사이트
```

## 사용 방법

### 1. 백엔드 배포 (RunPod)

1.  **도커 이미지 빌드 및 푸시**:
    ```bash
    cd backend
    docker build -t your-docker-id/3d-converter:latest .
    docker push your-docker-id/3d-converter:latest
    ```
2.  **RunPod 설정**:
    - RunPod Console에서 **Serverless -> Endpoints**로 이동합니다.
    - **New Endpoint**를 생성하고 위에서 푸시한 이미지를 사용합니다.
    - 생성된 **Endpoint ID**와 **API Key**를 메모해둡니다.
    - Endpoint 타입은 **Queue based**를 사용합니다.

### 2. 프론트엔드 설정 및 실행

1.  **의존성 설치**:
    ```bash
    cd ui
    npm install
    ```
2.  **API 연결**:
    - 앱 실행 후 상단 **Backend Settings**에서 설정합니다.
    - `Backend Type`:
      - `RunPod Runsync API` (운영/서버리스)
      - `Remote Convert API (POST /convert)` (로컬/원격 FastAPI)
    - RunPod 사용 시 URL 예시:
      - `https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync`
    - 같은 화면에서 API Key 입력 후 저장하면 브라우저에 저장되어 재실행 시 자동 복원됩니다.
3.  **실행**:
    ```bash
    npm run dev
    ```
    - 프론트엔드: `http://localhost:3000`

---

## 로컬 개발 및 테스트 (Hybrid Setup)

이 방식은 환경 구축이 까다로운 **백엔드(Blender)**만 도커로 띄우고, **프론트엔드**는 로컬에서 직접 실행하여 빠른 개발 속도를 유지하는 방식입니다.

### 1. 백엔드(Blender 서버) 실행 (Docker)
```bash
# 백엔드만 도커 컨테이너로 실행
docker-compose up --build
```
> 참고: `docker-compose.yml`은 프로젝트 루트에 있지만, `backend/`에서 실행해도 상위 디렉토리의 Compose 파일을 탐색해 동작할 수 있습니다. 혼동을 줄이려면 루트에서 실행하거나 `docker compose -f ../docker-compose.yml up --build`처럼 파일 경로를 명시하세요.

### 2. 프론트엔드 실행 (Local)
별도의 터미널을 열어 다음을 수행합니다.
```bash
cd ui
npm install
npm run dev
```

### 3. 접속 및 테스트
- 브라우저에서 `http://localhost:3000`에 접속합니다.
- 상단 **Backend Settings**를 열고:
  - `Backend Type`을 `Remote Convert API (POST /convert)`로 선택
  - `Remote API URL`을 `http://localhost:9001/convert`로 입력
  - `Check`로 연결 확인 후 변환 테스트
- 프론트엔드는 도커 백엔드 `http://localhost:9001/convert`와 통신합니다.

### 4. 문제 발생 시 로그 확인 (로컬 도커)
```bash
docker logs 3dpipe-backend --tail 300
```
- Blender/변환 관련 오류는 이 로그에서 먼저 확인합니다.

---

## 네이티브 로컬 서버 실행 (No Docker)

도커를 사용하지 않고 내 컴퓨터의 파이썬과 블렌더를 직접 사용하여 서버를 띄우는 방법입니다.

### 1. 환경 준비
- **Blender 설치**: [blender.org](https://www.blender.org/)에서 블렌더를 다운로드하여 설치합니다.
- **Python 패키지 설치**:
  ```bash
  cd backend
  pip install fastapi uvicorn python-multipart
  ```

### 2. 블렌더 경로 설정 (중요)
`backend/local_server.py` 파일의 35번 줄 부근 `blender_path = "blender"`를 본인의 설치 경로에 맞게 수정해야 합니다.
- **Mac**: `blender_path = "/Applications/Blender.app/Contents/MacOS/Blender"`
- **Windows**: `blender_path = "C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe"`

### 3. 서버 실행
```bash
python local_server.py
```
서버가 실행되면 프론트엔드에서 `http://localhost:9001/convert`를 통해 직접 통신할 수 있습니다.

---

## 로컬 테스트 방법 (Manual CLI)

### 1. Blender CLI 직접 사용 (Blender가 설치된 경우)
가장 간단하게 `converter.py` 스크립트만 테스트하는 방법입니다.
```bash
# 형식: blender --background --python backend/converter.py -- <입력파일> <출력파일>
/Applications/Blender.app/Contents/MacOS/Blender --background --python backend/converter.py -- test.glb test.fbx
```
*(Windows/Linux의 경우 Blender 실행 파일 경로를 본인의 환경에 맞게 수정하세요.)*

### 2. 도커를 이용한 로컬 테스트
실제 RunPod와 유사한 환경에서 테스트하고자 할 때 사용합니다.
1. **이미지 빌드**: `docker build -t 3d-test ./backend`
2. **컨테이너 실행 (대화형)**:
   ```bash
   docker run -it --entrypoint /bin/bash 3d-test
   ```
3. **컨테이너 내부에서 변환 실행**:
   ```bash
   blender --background --python converter.py -- input.glb output.fbx
   ```

### 3. RunPod API 연동 테스트 스크립트
`runpod-3d-conv-test.sh`는 실제 GLB 파일을 base64로 인코딩해 `runsync`로 전송합니다.

```bash
export RUNPOD_API_KEY='<YOUR_RUNPOD_API_KEY>'
export RUNPOD_ENDPOINT_ID='<YOUR_ENDPOINT_ID>'   # 생략 시 기본값 사용

./runpod-3d-conv-test.sh ./test.glb
```

주의:
- API Key는 스크립트에 하드코딩하지 말고 환경변수로만 사용하세요.
- 키가 노출되면 즉시 폐기(rotate)하세요.

## 주요 기능
- **Drag & Drop**: 쉽고 직분적인 파일 업로드.
- **Sequential Queue**: 여러 파일을 올려도 과부하 없이 하나씩 순차적으로 변환.
- **Serverless**: 사용한 만큼만 비용 지불 (RunPod 기준).
- **Auto-Download**: 변환 완료 시 즉시 브라우저로 다운로드.

## 변환 품질 참고사항
- GLB(PBR) → FBX 변환 시 셰이딩 모델 차이로 인해 반짝임/질감이 달라질 수 있습니다.
- 최근 변환 스크립트는 텍스처를 내보내기 전에 실제 이미지 파일로 정규화한 뒤 FBX에 포함하여, 텍스처 누락 가능성을 낮추도록 구성되어 있습니다.
- Blender에서 FBX가 회색으로 보일 경우, `Material Preview` 또는 `Rendered` 모드와 FBX 임포트 옵션의 `Image Search`를 확인하세요.

## RunPod Known Issue (대용량 파일)
현재 구조에서 RunPod `runsync` 호출 시, **큰 GLB를 JSON base64로 직접 전송**하면 요청 단계에서 실패할 수 있습니다.

- 증상:
  - 작은 파일은 성공, 큰 파일(예: 수십 MB 이상)은 400 실패
  - 컨테이너 내부 변환 이전 단계에서 거절되는 패턴
- 원인:
  - base64 전송 시 크기 팽창(약 33%) + 게이트웨이/요청 본문 제한 가능성

### TODO
- [ ] 프론트엔드에서 RunPod direct 업로드 시 파일 크기 제한 및 사용자 안내 추가
- [ ] `file_url` 입력 방식 지원 (S3/R2 pre-signed URL 기반)
- [ ] `handler.py`에서 `file_url` 다운로드 경로 지원
- [ ] 대용량 파일은 `run + status polling` 경로도 검토
