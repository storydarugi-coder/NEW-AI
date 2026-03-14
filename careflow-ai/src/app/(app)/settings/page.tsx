import { redirect } from "next/navigation";

export default function SettingsLegacyRedirect() {
  redirect("/hospital/settings");
}
