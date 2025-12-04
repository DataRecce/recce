/**
 * Root Page
 *
 * Redirects to /lineage by default.
 * The redirect is handled server-side for faster navigation.
 */

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/lineage");
}
