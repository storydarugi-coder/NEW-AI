import { redirect } from "next/navigation";

export default function SourceReviewLegacyRedirect() {
  redirect("/internal/source-review");
}
