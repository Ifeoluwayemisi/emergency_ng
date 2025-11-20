"use client";

import { useEffect, useState } from "react";
import { api } from "../../utils/api";

export default function FirstAid() {
  const [data, setData] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/firstaid").then((res) => setData(res.data));
  }, []);

  const filtered = data.filter((item) =>
    item.title.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-red-600 mb-4">First Aid Guide</h1>

      <input
        type="text"
        placeholder="Search..."
        className="w-full p-2 border rounded mb-4"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white shadow p-4 rounded border-l-4 border-red-500"
          >
            <h3 className="font-semibold text-xl">{item.title}</h3>
            <p className="text-gray-600 mt-2">{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
