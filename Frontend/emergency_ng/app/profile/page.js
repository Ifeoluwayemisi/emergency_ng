"use client";

import { useState, useEffect } from "react";
import { api, setAuthToken } from "../../utils/api";
import { getToken } from "../../utils/auth";

export default function Profile() {
  const [data, setData] = useState(null);
  const [image, setImage] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return (window.location.href = "/login");
    setAuthToken(token);

    api.get("/profile").then((res) => setData(res.data));
  }, []);

  const uploadImage = async () => {
    const form = new FormData();
    form.append("image", image);

    const res = await api.post("/profile/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    alert("Uploaded!");
    setData({ ...data, imageUrl: res.data.url });
  };

  if (!data) return <p>Loading…</p>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-red-600 mb-4">Profile</h1>

      <div className="bg-white p-4 rounded shadow max-w-lg">
        <img
          src={data.imageUrl || "/icons/user-placeholder.png"}
          className="w-32 h-32 rounded-full object-cover mb-4"
        />

        <p className="font-semibold text-lg">
          {data.name}{" "}
          {data.verified && (
            <span className="text-teal-600 text-sm ml-2">(Verified)</span>
          )}
        </p>

        <p className="text-gray-600">{data.email}</p>

        <input
          type="file"
          className="mt-4"
          onChange={(e) => setImage(e.target.files[0])}
        />
        <button
          onClick={uploadImage}
          className="px-4 py-2 bg-red-600 text-white rounded mt-2"
        >
          Upload Picture
        </button>
      </div>
    </div>
  );
}