// utils/auth.js

// Save JWT token to localStorage
export function setToken(token) {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
}

// Get JWT token from localStorage
export function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

// Clear JWT token (logout)
export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

// Helper to check if user is logged in
export function isLoggedIn() {
  return !!getToken();
}
