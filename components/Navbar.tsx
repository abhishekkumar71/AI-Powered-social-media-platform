// components/Navbar.tsx
"use client";

import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { Link as ScrollLink } from "react-scroll";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const links = [
    { name: "Home", href: "hero" },
    { name: "Features", href: "features" },
    { name: "Contact", href: "footer" },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <AppBar position="sticky" color="transparent" elevation={2} sx={{ backdropFilter: "blur(6px)" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <img src="/logo.png" alt="logo" style={{ height: 36 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a" }}>PostPilot</Typography>
        </Box>

        {/* Desktop Links */}
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 2, alignItems: "center" }}>
          {links.map((link) => (
            <ScrollLink key={link.href} to={link.href} smooth offset={-70}>
              <Button sx={{ textTransform: "none" }}>{link.name}</Button>
            </ScrollLink>
          ))}

          <Button variant="contained" href="/dashboard" sx={{ ml: 1 }}>
            Dashboard
          </Button>

          {/* Auth buttons */}
          {session ? (
            <>
              <Typography sx={{ ml: 1 }}>{session.user?.name}</Typography>
              <Button
                onClick={() => signOut()}
                variant="outlined"
                color="error"
                sx={{ ml: 1 }}
              >
                Logout
              </Button>
            </>
          ) : (
            <Button
              onClick={() => signIn("google")}
              variant="contained"
              color="primary"
              sx={{ ml: 1 }}
            >
              Login with Google
            </Button>
          )}
        </Box>

        {/* Mobile Menu Icon */}
        <IconButton sx={{ display: { md: "none" } }} onClick={() => setMenuOpen((s) => !s)}>
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </IconButton>
      </Toolbar>

      {/* Mobile Menu */}
      <Box sx={{
        display: { xs: menuOpen ? "block" : "none", md: "none" },
        p: 2,
        borderTop: "1px solid rgba(0,0,0,0.06)"
      }}>
        {["Home", "Features", "Contact"].map((t) => (
          <ScrollLink key={t} to={t.toLowerCase()} smooth offset={-70} onClick={() => setMenuOpen(false)}>
            <Button fullWidth sx={{ justifyContent: "flex-start", textTransform: "none" }}>{t}</Button>
          </ScrollLink>
        ))}

        <Button fullWidth href="/dashboard" sx={{ mt: 1 }} variant="contained">Dashboard</Button>

        {/* Mobile auth buttons */}
        {session ? (
          <>
            <Typography sx={{ mt: 1 }}>{session.user?.name}</Typography>
            <Button fullWidth onClick={() => signOut()} sx={{ mt: 1 }} variant="outlined" color="error">
              Logout
            </Button>
          </>
        ) : (
          <Button fullWidth onClick={() => signIn("google")} sx={{ mt: 1 }} variant="contained" color="primary">
            Login with Google
          </Button>
        )}
      </Box>
    </AppBar>
  );
}
