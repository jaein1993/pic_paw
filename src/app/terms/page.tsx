import { Header } from '@/shared/components/layout/Header';
import { Footer } from '@/shared/components/layout/Footer';

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-2">이용약관</h1>
        <p className="text-text-secondary text-sm mb-8">최종 업데이트: 2026년 5월</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">서비스 이용</h2>
            <p>
              본 서비스는 시연용 MVP로 제공됩니다. 서비스는 무료이며 회원가입 없이 이용할 수
              있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">이미지 권리</h2>
            <p>
              사용자가 업로드하는 모든 이미지의 저작권은 사용자에게 있습니다. 서비스는 해당
              이미지를 서버에 저장하거나 제3자와 공유하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">금지 사항</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>타인의 사진을 무단으로 업로드하는 행위</li>
              <li>불법적인 목적으로 서비스를 이용하는 행위</li>
              <li>서비스의 정상적인 운영을 방해하는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text-primary mb-3">면책 조항</h2>
            <p>
              본 서비스는 시연용 MVP이며, 서비스의 가용성이나 결과물의 품질을 보장하지 않습니다.
              서비스 이용으로 인한 손해에 대해 책임을 지지 않습니다.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
