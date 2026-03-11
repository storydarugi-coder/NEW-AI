export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center space-y-3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
        <p className="text-sm text-gray-500">설정을 불러오는 중...</p>
      </div>
    </div>
  );
}
