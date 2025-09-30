import { useState } from "react";
import axios from "axios";

export default function NewPostForm() {
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const generateContent = async () => {
    if (!prompt) return alert("Enter a prompt first!");
    setLoading(true);
    try {
      const res = await axios.post("/api/generate-content", { prompt });
      setContent(res.data.content);
    } catch (err) {
      console.error(err);
      alert("Failed to generate content");
    } finally {
      setLoading(false);
    }
  };
  async function postToInstagram() {
    const res = await fetch("/api/postToInstagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: "Hello, this is a test post from Post Pilot!",
        imageUrl: "https://your-image.jpg",
      }),
    });

    const data = await res.json();
    console.log(data);
  }

  return (
    <div>
      <textarea
        placeholder="Enter prompt for AI content..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button onClick={generateContent} disabled={loading}>
        {loading ? "Generating..." : "Generate AI Content"}
      </button>

      <textarea
        placeholder="Generated content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button onClick={postToInstagram}>Post Now</button>
    </div>
  );
}
