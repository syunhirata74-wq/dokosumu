"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { TownProfile } from "@/lib/diagnosis";
import Link from "next/link";
import { toast } from "sonner";

export default function HomePage() {
  const { user, profile } = useAuth();
  const [towns, setTowns] = useState<TownProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number } | null>(null);
  const [likedCount, setLikedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/town-profiles.json")
      .then((r) => r.json())
      .then((data: TownProfile[]) => {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setTowns(shuffled);
        setLoading(false);
      });
  }, []);

  if (!profile?.couple_id) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">💑</div>
          <h2 className="text-lg font-bold">はじめましょう！</h2>
          <p className="text-sm text-muted-foreground">二人でアプリを使うための設定をします</p>
          <Link href="/onboarding" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium">
            セットアップを始める
          </Link>
        </div>
      </div>
    );
  }

  const currentTown = towns[currentIndex];
  const isComplete = currentIndex >= towns.length && towns.length > 0;

  async function swipe(direction: "left" | "right") {
    if (!currentTown || !profile?.couple_id) return;

    setSwipeDir(direction);

    if (direction === "right") {
      // Add to wishlist
      const { error } = await supabase.from("towns").insert({
        couple_id: profile.couple_id,
        name: currentTown.name + "エリア",
        station: currentTown.name + "駅",
        station_code: currentTown.code,
        visited: false,
        lat: 0,
        lng: 0,
      });
      if (!error) {
        setLikedCount((c) => c + 1);
        toast.success(`💗 ${currentTown.name}をマッチリストに追加！`);
      }
    }

    setTimeout(() => {
      setSwipeDir(null);
      setDragX(0);
      setCurrentIndex((i) => i + 1);
    }, 300);
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart({ x: e.touches[0].clientX });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStart) return;
    setDragX(e.touches[0].clientX - touchStart.x);
  }

  function handleTouchEnd() {
    if (Math.abs(dragX) > 80) {
      swipe(dragX > 0 ? "right" : "left");
    } else {
      setDragX(0);
    }
    setTouchStart(null);
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-pulse text-4xl">🃏</div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold">全ての町をチェックしました！</h2>
          <p className="text-sm text-muted-foreground">
            {likedCount}件の町とマッチしました
          </p>
          <div className="space-y-3">
            <Link href="/matches" className="block px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium">
              💗 マッチを見る
            </Link>
            <button
              onClick={() => {
                const shuffled = [...towns].sort(() => Math.random() - 0.5);
                setTowns(shuffled);
                setCurrentIndex(0);
                setLikedCount(0);
              }}
              className="block w-full px-6 py-3 border rounded-full font-medium text-sm"
            >
              🔄 もう一回
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentTown) return null;

  const rotation = dragX * 0.08;
  const scoreIcons: Record<string, string> = {
    cafe: "☕", nightlife: "🌃", quiet: "🌙", nature: "🌿",
    family: "👶", shopping: "🛍️", gourmet: "🍽️",
    access: "🚃", cost: "💰", safety: "🔒",
  };

  return (
    <div className="min-h-[80vh] flex flex-col p-4 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">🃏 発見</h1>
        <span className="text-xs text-muted-foreground">
          💗 {likedCount}
        </span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Swipe labels */}
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-gray-100 rounded-full px-3 py-2 text-sm font-bold text-gray-500 transition-opacity"
          style={{ opacity: dragX < -30 ? Math.min(1, Math.abs(dragX) / 100) : 0 }}
        >
          NOPE
        </div>
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-pink-100 rounded-full px-3 py-2 text-sm font-bold text-pink-500 transition-opacity"
          style={{ opacity: dragX > 30 ? Math.min(1, dragX / 100) : 0 }}
        >
          LIKE
        </div>

        <div
          className={`w-full rounded-2xl shadow-xl border overflow-hidden bg-card transition-all ${
            swipeDir === "right"
              ? "translate-x-[120%] rotate-12 opacity-0"
              : swipeDir === "left"
                ? "-translate-x-[120%] -rotate-12 opacity-0"
                : ""
          }`}
          style={
            !swipeDir
              ? {
                  transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
                  transition: dragX === 0 ? "transform 0.3s" : "none",
                }
              : undefined
          }
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Town visual header */}
          <div className="bg-gradient-to-br from-pink-200 via-pink-100 to-white p-8 text-center">
            <h2 className="text-3xl font-bold mb-1">{currentTown.name}</h2>
            <p className="text-sm text-muted-foreground">{currentTown.pref}</p>
            <div className="flex justify-center gap-1 mt-3">
              {currentTown.tags.map((tag) => (
                <span key={tag} className="bg-white/70 text-xs px-2 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              {currentTown.description}
            </p>

            <div className="flex justify-center">
              <div className="bg-muted rounded-full px-4 py-2 text-sm font-bold">
                💰 {(currentTown.rent2ldk / 10000).toFixed(0)}万円 / 月
              </div>
            </div>

            {/* Top scores */}
            <div className="flex justify-center gap-3">
              {Object.entries(currentTown.scores)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4)
                .map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className="text-lg">{scoreIcons[key]}</div>
                    <div className="flex gap-0.5 justify-center mt-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={`text-[8px] ${s <= val ? "text-pink-400" : "text-gray-200"}`}>●</span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center items-center gap-6 mt-4 mb-2">
        <button
          onClick={() => swipe("left")}
          className="w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center text-2xl active:scale-90 transition-transform bg-white shadow-lg"
        >
          ✕
        </button>
        <button
          onClick={() => swipe("right")}
          className="w-20 h-20 rounded-full border-2 border-pink-400 flex items-center justify-center text-3xl active:scale-90 transition-transform bg-white shadow-lg"
        >
          💗
        </button>
      </div>
    </div>
  );
}
