import { redirect } from "next/navigation";

export default function RootRedirect() {
  redirect("/hospital/dashboard");
}
