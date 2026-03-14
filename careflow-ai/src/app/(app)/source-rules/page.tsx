import { redirect } from "next/navigation";

export default function SourceRulesLegacyRedirect() {
  redirect("/internal/source-rules");
}
