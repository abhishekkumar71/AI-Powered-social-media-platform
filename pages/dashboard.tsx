import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Stack,
  Paper,
} from "@mui/material";
import { useNotification } from "@/lib/providers/NotificationProvider";
import { useLoading } from "@/lib/providers/LoadingProvider";
import XIcon from "@mui/icons-material/X";
import { useSession, signIn } from "next-auth/react"; // added

export default function NewPostForm() {
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const { notify } = useNotification();
  const { setLoading } = useLoading();
  const { data: session } = useSession(); // added

  useEffect(() => {
    (async () => {
      if (!session) return; // skip API call if not logged in
      try {
        setLoading(true);
        const res = await axios.get("/api/auth/twitter/status");
        setIsConnected(Boolean(res.data.isValid));
      } catch (err) {
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [session]); // added session as dependency

  const generateContent = async () => {
    if (!session) return signIn(); // check login
    if (!prompt)
      return notify({ message: "Enter a prompt", severity: "warning" });
    setGenerating(true);
    try {
      const res = await axios.post("/api/auth/generate-content", { prompt });
      const generated = res.data.content ?? "";
      setContent((prev) => (prev ? prev + "\n" + generated : generated));
      notify({ message: "Content generated", severity: "success" });
    } catch (err) {
      console.error(err);
      notify({ message: "Failed to generate content", severity: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const postToInstagram = async () => {
    if (!session) return signIn(); // check login
    setPosting(true);
    try {
      const imageUrl =
        "https://images.unsplash.com/photo-1758593386023-55329f5b3386?w=600&auto=format&fit=crop&q=60";
      const res = await axios.post("/api/auth/postToIG", {
        caption: content,
        imageUrl,
      });
      if (res.data.success)
        notify({ message: "Instagram posted", severity: "success" });
      else
        notify({ message: "Failed to post to Instagram", severity: "error" });
    } catch (err) {
      console.error(err);
      notify({ message: "Error posting to Instagram", severity: "error" });
    } finally {
      setPosting(false);
    }
  };

  const postToTwitter = async () => {
    if (!session) return signIn(); // check login
    setPosting(true);
    try {
      const res = await axios.post("/api/auth/twitter/postToX", {
        text: content,
      });
      if (res.data.success) {
        notify({
          message: "Posted to X (Twitter) successfully",
          severity: "success",
        });
      } else if (res.data.redirect) {
        window.location.href = res.data.redirect;
      } else {
        notify({ message: "Failed to post to X", severity: "error" });
      }
    } catch (err: any) {
      console.error("Post error", err?.response?.data ?? err);
      notify({ message: "Error posting to X", severity: "error" });
    } finally {
      setPosting(false);
    }
  };

  const connectTwitter = async () => {
    if (!session) return signIn(); // check login
    try {
      const res = await axios.get("/api/auth/twitter/connect");
      if (res.data.redirect) {
        window.location.href = res.data.redirect;
      } else {
        notify({
          message: "Failed to start Twitter connect",
          severity: "error",
        });
      }
    } catch (err) {
      console.error(err);
      notify({ message: "Failed to connect to Twitter", severity: "error" });
    }
  };

  return (
    <Paper
      sx={{ p: { xs: 2, md: 4 }, maxWidth: 820, margin: "24px auto" }}
      elevation={3}
    >
      <Typography variant="h5" gutterBottom>
        Create and Post Content
      </Typography>

      <Stack spacing={2}>
        <TextField
          label="Prompt for AI content"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          multiline
          rows={3}
          fullWidth
        />

        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="contained"
            onClick={generateContent}
            disabled={generating || !session} // disabled if not logged in
          >
            {generating ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Generate AI Content"
            )}
          </Button>
          <Button variant="outlined" onClick={() => setContent("")}>
            Clear
          </Button>
        </Box>

        <TextField
          label="Generated content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          multiline
          rows={4}
          fullWidth
        />

        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="contained"
            color="secondary"
            onClick={postToInstagram}
            disabled={posting || !content || !session} 
          >
            {posting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Post to Instagram"
            )}
          </Button>

          {isConnected === null ? (
            <Button disabled>
              <XIcon />
              Checking Twitter...
            </Button>
          ) : isConnected ? (
            <Button
              variant="contained"
              color="primary"
              onClick={postToTwitter}
              disabled={posting || !content || !session} 
            >
              <XIcon />
              {posting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Post to X"
              )}
            </Button>
          ) : (
            <Button
              variant="outlined"
              onClick={connectTwitter}
              disabled={posting || !session} // added session check
            >
              <XIcon />
              {posting ? <CircularProgress size={20} color="inherit" /> : "Connect Twitter"}
            </Button>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
