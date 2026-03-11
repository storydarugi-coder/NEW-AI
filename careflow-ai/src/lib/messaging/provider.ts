/**
 * 메시지 발송 Provider 추상화
 *
 * 현재: Mock 발송 (실제 전송 없음)
 * 향후: 카카오 알림톡, NHN SMS 등 실제 발송 연동
 *
 * 실제 연동 시 필요한 것:
 * - 카카오 알림톡: 카카오 비즈니스 채널 ID + API 키 + 승인된 템플릿
 * - NHN SMS: NHN Cloud 인증키 + 발신번호
 * - 환경변수: KAKAO_CHANNEL_ID, KAKAO_API_KEY, SMS_API_KEY, SMS_SENDER_NUMBER
 */

export interface SendRequest {
  recipientPhone: string;
  recipientName: string;
  content: string;
  templateCode?: string; // 카카오 알림톡 템플릿 코드
}

export interface SendResult {
  success: boolean;
  externalId?: string;
  failReason?: string;
  provider: string;
}

export interface MessageProvider {
  name: string;
  send(request: SendRequest): Promise<SendResult>;
}

/**
 * Mock Provider — 개발/데모용
 * 실제 전송 없이 성공 응답 반환
 */
export class MockMessageProvider implements MessageProvider {
  name = "mock";

  async send(request: SendRequest): Promise<SendResult> {
    // 시뮬레이션: 95% 성공, 5% 실패
    const random = Math.random();
    if (random < 0.05) {
      return {
        success: false,
        failReason: "[Mock] 시뮬레이션 발송 실패",
        provider: this.name,
      };
    }

    return {
      success: true,
      externalId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      provider: this.name,
    };
  }
}

/**
 * 카카오 알림톡 Provider (Stub)
 *
 * 실제 연동 시:
 * 1. 카카오 비즈니스 채널 개설
 * 2. 알림톡 템플릿 등록 및 승인
 * 3. API 키 발급
 * 4. 환경변수 설정: KAKAO_CHANNEL_ID, KAKAO_API_KEY
 * 5. 이 클래스의 send() 메서드에 실제 API 호출 구현
 *
 * API 엔드포인트: https://kapi.kakao.com/v2/api/talk/memo/default/send
 * 문서: https://developers.kakao.com/docs/latest/ko/message/rest-api
 */
export class KakaoAlimtalkProvider implements MessageProvider {
  name = "kakao_alimtalk";

  async send(_request: SendRequest): Promise<SendResult> {
    // TODO: 실제 카카오 알림톡 API 연동
    // const channelId = process.env.KAKAO_CHANNEL_ID;
    // const apiKey = process.env.KAKAO_API_KEY;
    //
    // const response = await fetch("https://kapi.kakao.com/...", {
    //   method: "POST",
    //   headers: { Authorization: `KakaoAK ${apiKey}` },
    //   body: JSON.stringify({
    //     template_id: request.templateCode,
    //     receiver_uuids: [...],
    //   }),
    // });

    return {
      success: false,
      failReason: "카카오 알림톡 연동 미완료 — 환경변수 설정 필요",
      provider: this.name,
    };
  }
}

/**
 * 현재 설정된 Provider를 반환
 */
export function getMessageProvider(): MessageProvider {
  const providerName = process.env.MESSAGE_PROVIDER || "mock";

  switch (providerName) {
    case "kakao_alimtalk":
      return new KakaoAlimtalkProvider();
    default:
      return new MockMessageProvider();
  }
}
