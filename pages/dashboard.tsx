import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Stack,
  Paper,
  Avatar,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { useNotification } from "@/lib/providers/NotificationProvider";
import { useLoading } from "@/lib/providers/LoadingProvider";
import XIcon from "@mui/icons-material/X";
import { useSession, signIn } from "next-auth/react";

export default function NewPostForm() {
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [twitterUsername, setTwitterUsername] = useState("");
  const [twitterPassword, setTwitterPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { notify } = useNotification();
  const { setLoading } = useLoading();
  const { data: session } = useSession();

  // check connection
  const checkConnection = async () => {
    if (!session) return signIn();
    try {
      setLoading(true);
      const res = await axios.get("/api/auth/twitter/status");
      setIsConnected(Boolean(res.data.isValid));
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, [session]);

  const saveCredentials = async () => {
    try {
      setSaving(true);
      setSaveMessage("");

      const res = await fetch("/api/user/updateCredentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitterUsername, twitterPassword }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveMessage("Credentials saved successfully!");
      } else {
        setSaveMessage("Failed to save credentials. Try again.");
      }
    } catch (err) {
      console.error("Error saving credentials:", err);
      setSaveMessage("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const connectTwitter = async () => {
    const userId = session?.user?.id;
    if (!userId) return signIn();
    setPosting(true);
    try {
      const res = await axios.post("/api/auth/twitter/connectToX", { userId });
      if (res.data.success) {
        notify({ message: "Connected to X successfully", severity: "success" });
        checkConnection();
      } else {
        notify({ message: "Failed to connect to X", severity: "error" });
        setIsConnected(false);
      }
    } catch (err) {
      console.error(err);
      notify({ message: "Failed to connect to X", severity: "error" });
      setIsConnected(false);
    } finally {
      setPosting(false);
    }
  };

  const generateContent = async () => {
    if (!session) return signIn();
    if (!prompt)
      return notify({ message: "Enter a prompt", severity: "warning" });
    setGenerating(true);
    try {
      const res = await axios.post("/api/auth/generate-content", { prompt });
      const generated = res.data.content ?? "";
      setContent((p) => (p ? p + "\n" + generated : generated));
      notify({ message: "Content generated", severity: "success" });
    } catch (err) {
      console.error(err);
      notify({ message: "Failed to generate content", severity: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const generateMedia = async () => {
    if (!session) return signIn();
    if (!prompt)
      return notify({
        message: "Enter a prompt for media",
        severity: "warning",
      });
    setGenerating(true);
    try {
      const res = await axios.post("/api/auth/generate-media", { prompt });
      if (res.data.url) setMediaUrls((prev) => [...prev, res.data.url]);
      notify({ message: "Media generated", severity: "success" });
    } catch (err) {
      console.error(err);
      notify({ message: "Failed to generate media", severity: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session) return signIn();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const videos = Array.from(files).filter((f) => f.type.startsWith("video/"));

    if (images.length && videos.length) {
      notify({
        message: "You can’t upload images and videos together.",
        severity: "warning",
      });
      return;
    }

    // enforce combined limits
    const existingImagesCount = mediaUrls.filter(
      (u) => !u.includes("video")
    ).length;
    const existingVideoCount = mediaUrls.filter((u) =>
      u.includes("video")
    ).length;

    if (images.length && existingImagesCount + images.length > 4) {
      notify({
        message: "You can upload up to 4 images per post.",
        severity: "warning",
      });
      return;
    }
    if (videos.length && existingVideoCount + videos.length > 1) {
      notify({
        message: "You can upload only 1 video per post.",
        severity: "warning",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        const res = await axios.post("/api/upload-media", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (p) => {
            if (p.total)
              setUploadProgress(Math.round((p.loaded * 100) / p.total));
          },
        });
        if (res.data.url) uploaded.push(res.data.url);
      }
      if (uploaded.length) setMediaUrls((prev) => [...prev, ...uploaded]);
      notify({ message: "Media uploaded successfully", severity: "success" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      notify({ message: "Failed to upload media", severity: "error" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeMedia = (idx: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const postToTwitter = async () => {
    if (!session) return signIn();
    if (!content)
      return notify({ message: "Enter content to post", severity: "warning" });
    setPosting(true);
    try {
      const res = await axios.post("/api/auth/twitter/postToX", {
        userId: session.user?.id,
        text: content,
        mediaUrls,
      });
      if (res.data.success) {
        notify({ message: "Posted to X successfully", severity: "success" });
        setContent("");
        setMediaUrls([]);
      } else if (res.data.needReconnect) {
        notify({
          message: "X session expired, reconnect",
          severity: "warning",
        });
        setIsConnected(false);
      } else {
        notify({ message: "Failed to post to X", severity: "error" });
      }
    } catch (err) {
      console.error(err);
      notify({ message: "Error posting to X", severity: "error" });
    } finally {
      setPosting(false);
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
        {(!session?.user?.twitterUsername ||
          !session?.user.twitterPassword) && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: "#fafafa" }} elevation={1}>
            <Typography variant="h6" gutterBottom>
              Connect X Account
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="X Username or Email"
                value={twitterUsername}
                onChange={(e) => setTwitterUsername(e.target.value)}
                fullWidth
              />
              <TextField
                label="X Password"
                type="password"
                value={twitterPassword}
                onChange={(e) => setTwitterPassword(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                onClick={saveCredentials}
                disabled={saving || !twitterUsername || !twitterPassword}
              >
                {saving ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Save Credentials"
                )}
              </Button>
              {saveMessage && (
                <Typography variant="body2" color="text.secondary">
                  {saveMessage}
                </Typography>
              )}
            </Stack>
          </Paper>
        )}

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
            disabled={generating || !session}
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
          <Button
            variant="outlined"
            onClick={generateMedia}
            disabled={generating || !session}
          >
            {generating ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Regenerate Image (Gemini AI)"
            )}
          </Button>
          {!isConnected && (
            <Button variant="outlined" color="error" onClick={connectTwitter}>
              Connect X
            </Button>
          )}
        </Box>

        <TextField
          label="Generated content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          multiline
          rows={4}
          fullWidth
        />

        {/* Media upload + preview */}
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={uploadMedia}
            accept="image/*,video/*"
            multiple
          />
          <Button
            variant="contained"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <CircularProgress size={20} /> : "Upload Media"}
          </Button>

          {uploading && uploadProgress > 0 && (
            <Typography variant="body2" color="text.secondary">
              Uploading: {uploadProgress}%
            </Typography>
          )}

          <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
            {mediaUrls.map((url, idx) => (
              <Box key={idx} position="relative">
                {url.includes("video") || url.endsWith(".mp4") ? (
                  <video
                    src={url}
                    width={80}
                    height={80}
                    controls
                    style={{ borderRadius: 8 }}
                  />
                ) : (
                  <Avatar
                    src={url}
                    variant="rounded"
                    sx={{ width: 80, height: 80 }}
                  />
                )}
                <IconButton
                  size="small"
                  onClick={() => removeMedia(idx)}
                  sx={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    bgcolor: "rgba(0,0,0,0.6)",
                  }}
                >
                  <CloseIcon sx={{ color: "#fff", fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}

            {/* + shows only after at least one image exists (not for video) */}
            {mediaUrls.filter((u) => !u.includes("video")).length > 0 &&
              mediaUrls.filter((u) => !u.includes("video")).length < 4 &&
              !mediaUrls.some((u) => u.includes("video")) && (
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    border: "1px dashed rgba(0,0,0,0.12)",
                    width: 40,
                    height: 40,
                  }}
                >
                  <AddIcon />
                </IconButton>
              )}
          </Box>
        </Box>

        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              /* Post to IG code if needed */
            }}
            disabled={posting || !content || !session || mediaUrls.length === 0}
          >
            {posting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Post to Instagram"
            )}
          </Button>

          {isConnected === null ? (
            <Button disabled>
              <XIcon /> Checking Twitter...
            </Button>
          ) : isConnected ? (
            <Button
              variant="contained"
              color="primary"
              onClick={postToTwitter}
              disabled={
                posting || (!content && mediaUrls.length == 0) || !session
              }
            >
              <XIcon />{" "}
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
              disabled={posting || !session}
            >
              <XIcon />{" "}
              {posting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Connect Twitter"
              )}
            </Button>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
