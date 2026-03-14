"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        CTA 관리 페이지를 불러올 수 없습니다
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        데이터베이스 연결을 확인해 주세요.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
