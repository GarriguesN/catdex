"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Trophy, Medal } from "lucide-react";
import Link from "next/link";
import { getPocketBase } from "@/lib/pocketbase";

interface Cat { id: string; name: string; photoCount: number; }
interface User { id: string; name: string; score: number; }

export default function StatsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const pb = getPocketBase();
      const result = await pb.collection("cats").getFullList();
      setCats(result.map((c: any) => ({ id: c.id, name: c.name, photoCount: c.photoCount || 0 })));

      const usersResult = await pb.collection("users").getFullList({
        sort: "-score",
        fields: "id,name,score",
      });
      setUsers(usersResult.filter((u: any) => (u.score || 0) > 0) as unknown as User[]);
    } catch (err) { console.error("Failed to load stats:", err); }
    setLoading(false);
  }

  if (loading) return <div className="py-8 space-y-4"><div className="skeleton h-32 w-full rounded-xl" /></div>;

  const totalPhotos = cats.reduce((s, c) => s + c.photoCount, 0);
  const topCat = cats.reduce<Cat | null>((b, c) => (!b || c.photoCount > b.photoCount ? c : b), null);

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-catdex-input-bg"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold">Estadísticas</h1>
      </div>

      <div className="card-pokedex p-4 grid grid-cols-2 gap-3 text-center">
        <div><p className="text-2xl font-bold text-catdex-orange">{cats.length}</p><p className="text-xs text-catdex-text-muted">Gatos</p></div>
        <div><p className="text-2xl font-bold text-catdex-blue">{totalPhotos}</p><p className="text-xs text-catdex-text-muted">Fotos</p></div>
      </div>

      {/* Leaderboard */}
      {users.length > 0 && (
        <div className="card-pokedex p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-catdex-yellow" />
            <h2 className="text-sm font-semibold text-catdex-text-muted">Ranking</h2>
          </div>
          <div className="space-y-2">
            {users.slice(0, 10).map((u, i) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-catdex-input-bg flex items-center justify-center text-xs font-bold">
                  {i === 0 ? <Medal className="h-3.5 w-3.5 text-yellow-400" /> :
                   i === 1 ? <span className="text-gray-400">{i + 1}</span> :
                   i === 2 ? <span className="text-amber-600">{i + 1}</span> :
                   <span className="text-catdex-text-muted">{i + 1}</span>}
                </div>
                <p className="flex-1 text-sm font-medium truncate">{u.name || "Sin nombre"}</p>
                <p className="text-sm font-bold text-catdex-orange">{u.score} pts</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCat && (
        <div className="card-pokedex p-4">
          <p className="text-xs font-semibold text-catdex-text-muted mb-2">Gato más fotografiado</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐱</span>
            <div><p className="font-semibold">{topCat.name}</p><p className="text-xs text-catdex-text-muted">{topCat.photoCount} fotos</p></div>
          </div>
        </div>
      )}

    </div>
  );
}
