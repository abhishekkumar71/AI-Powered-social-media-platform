// components/Footer.tsx
import React from "react";
import { Box, Typography, Link, Container } from "@mui/material";

export default function Footer() {
  return (
    <Box
      id="footer"
      sx={{
        mt: 8,
        py: 6,
        background: "linear-gradient(135deg, #3b82f6, #4f46e5)",
        color: "#fff",
      }}
    >
      <Container maxWidth="lg" sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>PostPilot</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>Automate your social presence</Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 3 }}>
          <Link href="#" underline="hover" sx={{ color: "#fff", "&:hover": { opacity: 0.8 } }}>About</Link>
          <Link href="#" underline="hover" sx={{ color: "#fff", "&:hover": { opacity: 0.8 } }}>Contact</Link>
          <Link href="#" underline="hover" sx={{ color: "#fff", "&:hover": { opacity: 0.8 } }}>Terms</Link>
        </Box>
      </Container>

      <Typography variant="caption" display="block" align="center" sx={{ mt: 3, opacity: 0.7 }}>
        © {new Date().getFullYear()} PostPilot. All rights reserved.
      </Typography>
    </Box>
  );
}
