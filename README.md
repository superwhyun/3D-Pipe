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

### 2. 프론트엔드 설정 및 실행

1.  **의존성 설치**:
    ```bash
    cd ui
    npm install
    ```
2.  **API 연결**:
    - `ui/src/app/page.tsx` 파일을 엽니다.
    - `RUNPOD_URL`의 `YOUR_ENDPOINT_ID`와 `RUNPOD_API_KEY`를 본인의 정보로 수정합니다.
    - 기본값은 RunPod 모드입니다. 로컬 백엔드를 쓰려면 `NEXT_PUBLIC_API_MODE=local`을 설정해야 합니다.
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
- 기본값은 RunPod 모드이므로, 로컬 백엔드를 쓸 때는 `ui/.env.local`에 아래 값을 넣어야 합니다.
  ```bash
  NEXT_PUBLIC_API_MODE=local
  ```
- **포트 확인**: 프론트엔드는 도커 백엔드 `http://localhost:9001/convert`와 통신합니다.

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

## 주요 기능
- **Drag & Drop**: 쉽고 직분적인 파일 업로드.
- **Sequential Queue**: 여러 파일을 올려도 과부하 없이 하나씩 순차적으로 변환.
- **Serverless**: 사용한 만큼만 비용 지불 (RunPod 기준).
- **Auto-Download**: 변환 완료 시 즉시 브라우저로 다운로드.

## 변환 품질 참고사항
- GLB(PBR) → FBX 변환 시 셰이딩 모델 차이로 인해 반짝임/질감이 달라질 수 있습니다.
- 최근 변환 스크립트는 텍스처를 내보내기 전에 실제 이미지 파일로 정규화한 뒤 FBX에 포함하여, 텍스처 누락 가능성을 낮추도록 구성되어 있습니다.
- Blender에서 FBX가 회색으로 보일 경우, `Material Preview` 또는 `Rendered` 모드와 FBX 임포트 옵션의 `Image Search`를 확인하세요.
