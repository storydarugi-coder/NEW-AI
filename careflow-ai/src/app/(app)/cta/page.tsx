import { redirect } from "next/navigation";

/**
 * 레거시 /cta → /internal/cpa 리다이렉트
 * 북마크, 외부 링크 호환을 위해 유지
 */
export default function CtaLegacyRedirect() {
  redirect("/internal/cpa");
}
