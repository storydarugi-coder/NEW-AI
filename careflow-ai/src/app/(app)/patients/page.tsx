import { redirect } from "next/navigation";

export default function PatientsLegacyRedirect() {
  redirect("/hospital/patients");
}
