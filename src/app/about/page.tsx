import { Header } from '@/shared/components/layout/Header';
import { Footer } from '@/shared/components/layout/Footer';

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-6">서비스 소개</h1>

        <div className="prose text-text-secondary space-y-6 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">한 줄 소개</h2>
            <p>
              강아지와 함께 즐기는 pic-paw 부스. 카메라로 4컷 자동 촬영을 통해,
              회원가입 없이 PC와 모바일 어디서나 우리 둘만의 스트립을 만들 수 있어요.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">주요 기능</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>강아지 사진 AI 누끼 (온디바이스, 사진 미전송)</li>
              <li>카메라 라이브 부스 — 강아지 위치 손가락/마우스로 조정</li>
              <li>5초 자동 카운트다운 × 4번 연속 촬영</li>
              <li>셀별 자동 데코(썬글라스/말풍선/하트핀)</li>
              <li>pic-paw 부스 스타일 테두리 3종 (블랙/파스텔핑크/크림)</li>
              <li>pic-paw 부스 스타일 스트립 PNG 다운로드</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">개인정보 보호</h2>
            <p>
              모든 이미지 처리는 사용자의 브라우저 내에서만 이루어집니다. 사진은 어떠한 서버로도
              전송되지 않으며, 저희는 사진 데이터를 수집하거나 저장하지 않습니다.
            </p>
          </section>

        </div>
      </main>
      <Footer />
    </>
  );
}
