# 🚗 웹푸시 구현 성공 가이드 (iOS/Safari 완벽 대응)

이 문서는 여러 번의 시행착오 끝에 성공한 **아이폰(iOS Safari) 및 Edge Runtime(Cloudflare Pages)** 환경에서의 웹푸시 구현 노하우를 정리한 것입니다.

## 🌟 성공의 핵심 (RFC 8291)
아이폰은 보안에 매우 엄격하여, 푸시 서버(Apple Push Service)가 201 응답을 주더라도 암호화 바이너리가 최신 표준인 **RFC 8291**을 1바이트라도 어기면 알림을 조용히 무시합니다.

### 핵심 성공 요인:
1.  **Web Crypto API 사용**: Node.js 전용 라이브러리에 의존하지 않고, Edge Runtime에서도 작동하는 순수 `crypto.subtle` API를 사용했습니다.
2.  **IKM 유도 파라미터**: 암호화 키 유도 시 `auth` secret과 함께 `"WebPush: info\0"`, `receiver_pubkey`, `sender_pubkey`를 정확한 순서로 조합해야 합니다.
3.  **바이너리 패딩**: AES-128-GCM 암호화 전 데이터 끝에 `0x02` 구분자를 붙이는 규칙을 엄격히 준수했습니다.
4.  **바이너리 조립 순서**: `salt(16) | rs(4) | idlen(1) | sender_pubkey(65) | ciphertext` 순서로 조립된 데이터를 전송해야 합니다.

---

## 💬 나중에 나(Gemini)에게 시킬 때 쓸 프롬프트

> "Cloudflare Pages(Edge Runtime) 환경에서 아이폰(iOS)에 푸시 알림을 보내려고 해. 이전에 성공했던 **RFC 8291 표준 기반의 Web Crypto 암호화 로직**을 적용해줘.
> 
> 핵심 요구사항:
> 1. `crypto.subtle`을 사용하여 HKDF로 PRK와 IKM을 유도할 것.
> 2. Info 파라미터에 `WebPush: info\0`와 함께 공개키 쌍을 포함할 것.
> 3. 암호화 방식은 `aes128gcm`이어야 하며, 바이너리 조립 시 salt(16바이트), RS(4096), IDLen(65바이트)를 정확히 맞출 것.
> 4. `atob`와 `Uint8Array`를 사용하여 바이너리를 직접 다루는 정밀한 로직을 작성해줘."

---

## 🛠 기술적 구조 요약 (app/actions.ts 참고)

### 1. VAPID 인증
- JWT 생성 시 `aud`(푸시 서비스 Origin), `exp`(만료시간), `sub`(관리자 메일)이 포함되어야 합니다.
- `Authorization: vapid t=[Token], k=[Public_Key]` 헤더를 사용합니다.

### 2. 암호화 흐름
- **ECDH**: 서버의 임시 키와 구독 정보의 `p256dh` 키를 교환하여 `sharedSecret` 생성.
- **HKDF (1단계)**: `sharedSecret`과 `auth` secret을 섞어 PRK 생성.
- **HKDF (2단계)**: PRK와 특정 포맷의 `info`를 섞어 실제 암호화 키(IKM) 생성.
- **AES-128-GCM**: IKM에서 유도된 CEK와 IV로 페이로드 암호화.

## ⚠️ 주의사항
- **아이폰 테스트**: 반드시 "홈 화면에 추가(PWA)"된 상태에서 알림 권한을 허용해야 테스트가 가능합니다.
- **환경 변수**: `VAPID_PRIVATE_KEY` 값은 따옴표나 공백 없이 서버 대시보드에 정확히 입력되어야 합니다.
