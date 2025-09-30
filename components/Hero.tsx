// components/Hero.tsx
import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

export default function Hero() {
  return (
    <section id="hero">
      <Box
        sx={{
          minHeight: { xs: "60vh", md: "70vh" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          backgroundImage: "url('/heroImg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          color: "white",
        }}
      >
        <Box
          sx={{
            width: "100%",
            textAlign: "center",
            p: 6,
            backdropFilter: "brightness(0.5)",
          }}
        >
          <Typography
            variant="h3"
            sx={{ fontWeight: 800, mb: 2, fontFamily: "Poppins, sans-serif" }}
          >
            Create, Generate & Post — on postPilot.
          </Typography>
          <Typography
            sx={{ fontSize: { xs: 14, sm: 16 }, mb: 3, opacity: 0.95 }}
          >
            Generate AI content and publish to Twitter, Instagram, LinkedIn —
            all from one place.
          </Typography>
          <Button
            variant="contained"
            size="large"
            href="/dashboard"
            sx={{ mr: 2 }}
          >
            Get Started
          </Button>
          <Button
            variant="contained"
            size="large"
            href="#features"
            color="secondary"
          >
            Learn more
          </Button>
        </Box>
      </Box>
    </section>
  );
}
