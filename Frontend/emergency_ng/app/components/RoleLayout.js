// components/RoleLayout.js
import Navbar from "./Navbar";

export default function RoleLayout({ children, role }) {
  // Role-based theme colors
  const themes = {
    user: "bg-blue-50 text-blue-900",
    responder: "bg-red-50 text-red-900",
    admin: "bg-green-50 text-green-900",
  };

  const themeClass = themes[role] || "bg-gray-50 text-gray-900";

  return (
    <div className={`${themeClass} min-h-screen flex flex-col`}>
      <Navbar role={role} />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
