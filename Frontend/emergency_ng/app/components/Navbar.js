"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HiMenu, HiX, HiBell } from "react-icons/hi";
import EmergencyForm from "./EmergencyForm";
export default function Navbar({ role }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const menus = {
    user: [
      { label: "Dashboard", href: "/dashboard/user" },
      { label: "Profile", href: "/dashboard/user/profile" },
    ],
    responder: [
      { label: "Dashboard", href: "/dashboard/responder" },
      { label: "Profile", href: "/dashboard/responder/profile" },
    ],
    admin: [
      { label: "Dashboard", href: "/dashboard/admin" },
      { label: "Profile", href: "/dashboard/admin/profile" },
    ],
  };

  const menuItems = menus[role] || [];

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch(
          `http://localhost:4000/emergencies/pending?role=${role}`
        );
        const data = await res.json();
        setNotifications(data.count || 0);
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    }
    fetchNotifications();
  }, [role]);

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo/Home */}
          <div
            className="text-xl font-bold text-gray-800 cursor-pointer flex items-center space-x-2"
            onClick={() => router.push("/")}
          >
            <span>🏥</span>
            <span>RapidAid</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {menuItems.map((item) => (
              <button
                key={item.href}
                className="hover:underline cursor-pointer text-gray-700"
                onClick={() => router.push(item.href)}
              >
                {item.label}
              </button>
            ))}

            <button
              onClick={() => setModalOpen(true)}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Create Emergency
            </button>

            {/* Notification bell */}
            <div
              className="relative cursor-pointer text-gray-700 hover:text-blue-600"
              onClick={() => router.push(`/dashboard/${role}/emergencies`)}
            >
              <HiBell size={24} />
              {notifications > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full px-1.5">
                  {notifications}
                </span>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-700 focus:outline-none"
            >
              {menuOpen ? <HiX size={24} /> : <HiMenu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white px-4 pt-2 pb-4 space-y-2 shadow-md">
          {menuItems.map((item) => (
            <button
              key={item.href}
              className="block w-full text-left hover:underline text-gray-700"
              onClick={() => {
                router.push(item.href);
                setMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}

          <button
            onClick={() => {
              setModalOpen(true);
              setMenuOpen(false);
            }}
            className="w-full bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Create Emergency
          </button>

          <div
            className="relative cursor-pointer text-gray-700 hover:text-blue-600 w-full text-left"
            onClick={() => {
              router.push(`/dashboard/${role}/emergencies`);
              setMenuOpen(false);
            }}
          >
            <HiBell size={24} className="inline mr-2" />
            <span className="align-middle">Emergencies</span>
            {notifications > 0 && (
              <span className="absolute top-0 right-2 bg-red-600 text-white text-xs font-bold rounded-full px-1.5">
                {notifications}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Emergency Modal */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
            <h2 className="text-xl font-bold mb-4">Create Emergency</h2>

            {/* ✅ Render the reusable EmergencyForm */}
            <EmergencyForm onClose={() => setModalOpen(false)} />

            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-2 right-2 text-gray-700 hover:text-gray-900"
            >
              <HiX size={24} />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
