// pages/index.tsx
import React from "react";
import Navbar from "@/components/Navbar";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import { Container, Box, Typography } from "@mui/material";

export default function Home() {
  return (
    <>
      <Navbar />
            <Box
        sx={{
          background: "linear-gradient(135deg, #4f46e5, #3b82f6)",
          color: "#fff",
          minHeight: "45vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          px: 2,
          py: 6,
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>
            PostPilot
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Generate AI-powered content and post to social platforms instantly.
          </Typography>
        </Container>
      </Box>

      {/* Features & Hero */}
        <Hero />
        <Features />

      <Footer />
    </>
  );
}
