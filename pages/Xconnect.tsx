import { useRouter } from "next/router";
import { useEffect } from "react";

export default function TwitterCallback() {
  const router = useRouter();
  const { pendingText } = router.query;

  useEffect(() => {
    if (pendingText) {
      // Call post route again with text
      fetch("/api/auth/twitter/postToX", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pendingText }),
      }).then(() => router.push("/dashboard"));
    } else {
      router.push("/dashboard");
    }
  }, [pendingText]);

  return <p>Posting to Twitter...</p>;
}
