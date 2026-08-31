/**
 * Where the API lives. One definition, imported by everything that calls it --
 * it was copied into a second file, which is one place too many for a value
 * that decides where every request in the app goes.
 */
const configured = import.meta.env?.VITE_API_BASE_URL;

export const API_BASE = configured
  ? configured.replace(/\/$/, "")
  : "https://dinevalley-backend.onrender.com";
