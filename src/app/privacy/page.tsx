import { Header } from '@/shared/components/layout/Header';
import { Footer } from '@/shared/components/layout/Footer';

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-2">
          개인정보처리방침
        </h1>
        <p className="text-text-secondary text-sm mb-8">최종 업데이트: 2026년 5월</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">수집하는 정보</h2>
            <p>
              본 서비스는 사용자의 개인정보를 수집하지 않습니다. 업로드된 이미지는 사용자의
              브라우저 내에서만 처리되며 서버로 전송되지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">이미지 처리</h2>
            <p>
              AI 배경 제거 모델은 최초 사용 시 약 25MB 크기로 사용자 기기의 브라우저(IndexedDB)에
              다운로드되어 저장됩니다. 이 데이터는 사진 처리 속도 향상을 위해 로컬에 캐시되며,
              언제든지 브라우저 설정에서 삭제할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">쿠키 및 로컬 스토리지</h2>
            <p>
              본 서비스는 편집 상태 유지를 위해 브라우저의 메모리(React 상태)만을 사용합니다.
              별도의 쿠키나 영구 로컬 스토리지를 사용하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">문의</h2>
            <p>개인정보 관련 문의사항은 서비스 내 피드백 채널을 이용해주세요.</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
