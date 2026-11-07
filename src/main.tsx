import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { LanguageProvider } from "./i18n";
import App from "./App";
import ThemeProvider from "./ThemeProvider";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter><LanguageProvider><AuthProvider><ThemeProvider><App /></ThemeProvider></AuthProvider></LanguageProvider></BrowserRouter></React.StrictMode>
);
