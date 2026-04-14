"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { TownProfile } from "@/lib/diagnosis";
import Link from "next/link";
import { toast } from "sonner";
import { X, Heart, MapPin, Coins, SlidersHorizontal, ChevronDown } from "lucide-react";

const PREF_OPTIONS = ["全て", "東京都", "神奈川県", "埼玉県", "千葉県", "大阪府", "京都府", "兵庫県", "奈良県"];
const RENT_OPTIONS = [
  { label: "上限なし", value: Infinity },
  { label: "〜10万", value: 100000 },
  { label: "〜15万", value: 150000 },
  { label: "〜20万", value: 200000 },
  { label: "〜25万", value: 250000 },
];

export default function HomePage() {
  const { profile } = useAuth();
  const [allTowns, setAllTowns] = useState<TownProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number } | null>(null);
  const [likedCount, setLikedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [prefFilter, setPrefFilter] = useState("全て");
  const [rentLimit, setRentLimit] = useState(Infinity);

  useEffect(() => {
    fetch("/town-profiles.json")
      .then((r) => r.json())
      .then((data: TownProfile[]) => {
        setAllTowns(data);
        setLoading(false);
      });
  }, []);

  const filteredTowns = useMemo(() => {
    let result = allTowns;
    if (prefFilter !== "全て") result = result.filter((t) => t.pref === prefFilter);
    if (rentLimit !== Infinity) result = result.filter((t) => t.rent2ldk <= rentLimit);
    return [...result].sort(() => Math.random() - 0.5);
  }, [allTowns, prefFilter, rentLimit]);

  // Reset index when filters change
  useEffect(() => {
    setCurrentIndex(0);
    setLikedCount(0);
  }, [prefFilter, rentLimit]);

  if (!profile?.couple_id) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-bold">はじめましょう</h2>
          <p className="text-sm text-muted-foreground">二人でアプリを使うための設定をします</p>
          <Link href="/onboarding" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium">
            セットアップを始める
          </Link>
        </div>
      </div>
    );
  }

  const currentTown = filteredTowns[currentIndex] as (TownProfile & { imageUrl?: string }) | undefined;
  const isComplete = currentIndex >= filteredTowns.length && filteredTowns.length > 0;
  const noResults = filteredTowns.length === 0 && !loading;

  async function swipe(direction: "left" | "right") {
    if (!currentTown || !profile?.couple_id) return;
    setSwipeDir(direction);
    if (direction === "right") {
      const { error } = await supabase.from("towns").insert({
        couple_id: profile.couple_id,
        name: currentTown.name + "エリア",
        station: currentTown.name + "駅",
        station_code: currentTown.code,
        visited: false, lat: 0, lng: 0,
      });
      if (!error) {
        setLikedCount((c) => c + 1);
        toast.success(`${currentTown.name} をマッチリストに追加`);
      }
    }
    setTimeout(() => { setSwipeDir(null); setDragX(0); setCurrentIndex((i) => i + 1); }, 300);
  }

  function handleTouchStart(e: React.TouchEvent) { setTouchStart({ x: e.touches[0].clientX }); }
  function handleTouchMove(e: React.TouchEvent) { if (touchStart) setDragX(e.touches[0].clientX - touchStart.x); }
  function handleTouchEnd() {
    if (Math.abs(dragX) > 80) swipe(dragX > 0 ? "right" : "left");
    else setDragX(0);
    setTouchStart(null);
  }

  if (loading) return <div className="min-h-[80vh] flex items-center justify-center"><div className="animate-pulse text-muted-foreground text-sm">読み込み中...</div></div>;

  const rotation = dragX * 0.08;

  return (
    <div className="min-h-[80vh] flex flex-col p-4 max-w-sm mx-auto">
      {/* Header with filter */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">発見</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Heart size={12} fill="currentColor" className="text-primary" /> {likedCount}
          </span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full transition-colors ${showFilters ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-card rounded-xl border p-3 mb-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">エリア</label>
            <div className="flex flex-wrap gap-1.5">
              {PREF_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPrefFilter(p)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    prefFilter === p ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {p === "全て" ? "全て" : p.replace(/[都府県]$/, "")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">家賃上限（2LDK）</label>
            <div className="flex flex-wrap gap-1.5">
              {RENT_OPTIONS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRentLimit(r.value)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    rentLimit === r.value ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {filteredTowns.length}件の町がヒット
          </p>
        </div>
      )}

      {/* No results */}
      {noResults && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground text-sm">条件に合う町がありません</p>
            <button onClick={() => { setPrefFilter("全て"); setRentLimit(Infinity); }} className="text-primary text-sm underline">
              フィルターをリセット
            </button>
          </div>
        </div>
      )}

      {/* Complete */}
      {isComplete && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-bold">全てチェック完了</h2>
            <p className="text-sm text-muted-foreground">{likedCount}件の町とマッチ</p>
            <Link href="/matches" className="block px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium">マッチを見る</Link>
            <button onClick={() => { setCurrentIndex(0); setLikedCount(0); }} className="block w-full px-6 py-3 border rounded-full text-sm">もう一回</button>
          </div>
        </div>
      )}

      {/* Card */}
      {currentTown && !isComplete && !noResults && (
        <>
          <div className="flex-1 flex items-center justify-center relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 rounded-full px-4 py-2 font-bold text-gray-400 border-2 border-gray-300 transition-opacity"
              style={{ opacity: dragX < -30 ? Math.min(1, Math.abs(dragX) / 100) : 0 }}>NOPE</div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 rounded-full px-4 py-2 font-bold text-primary border-2 border-primary transition-opacity"
              style={{ opacity: dragX > 30 ? Math.min(1, dragX / 100) : 0 }}>LIKE</div>

            <div
              className={`w-full rounded-2xl shadow-xl overflow-hidden bg-card transition-all ${
                swipeDir === "right" ? "translate-x-[120%] rotate-12 opacity-0" : swipeDir === "left" ? "-translate-x-[120%] -rotate-12 opacity-0" : ""
              }`}
              style={!swipeDir ? { transform: `translateX(${dragX}px) rotate(${rotation}deg)`, transition: dragX === 0 ? "transform 0.3s" : "none" } : undefined}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Photo */}
              <div className="relative h-56 bg-gradient-to-br from-emerald-200 to-emerald-100">
                {currentTown.imageUrl && (
                  <img src={currentTown.imageUrl} alt={currentTown.name} className="w-full h-full object-cover" loading="eager" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <h2 className="text-2xl font-bold drop-shadow-lg">{currentTown.name}</h2>
                  <div className="flex items-center gap-1 text-sm opacity-90">
                    <MapPin size={14} />
                    <span>{currentTown.pref}</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">{currentTown.description}</p>
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{(currentTown.rent2ldk / 10000).toFixed(0)}万円 / 月</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentTown.tags.map((tag) => (
                    <span key={tag} className="bg-muted text-xs px-2.5 py-1 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center items-center gap-8 mt-4 mb-2">
            <button onClick={() => swipe("left")} className="w-14 h-14 rounded-full border-2 border-gray-300 flex items-center justify-center active:scale-90 transition-transform bg-white shadow-md">
              <X size={24} className="text-gray-400" />
            </button>
            <button onClick={() => swipe("right")} className="w-[72px] h-[72px] rounded-full border-2 border-primary flex items-center justify-center active:scale-90 transition-transform bg-white shadow-md">
              <Heart size={28} className="text-primary" fill="currentColor" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
