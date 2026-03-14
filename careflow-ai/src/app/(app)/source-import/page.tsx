import { redirect } from "next/navigation";

export default function SourceImportLegacyRedirect() {
  redirect("/internal/import");
}
