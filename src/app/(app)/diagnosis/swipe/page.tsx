"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TownProfile } from "@/lib/diagnosis";
import { Heart, Hand, PartyPopper, Coffee, Sunset, Moon, TreePine, Baby, ShoppingBag, UtensilsCrossed, Train, Coins, ShieldCheck } from "lucide-react";

const SCORE_ICON_MAP: Record<string, React.ReactNode> = {
  cafe: <Coffee size={16} />,
  nightlife: <Sunset size={16} />,
  quiet: <Moon size={16} />,
  nature: <TreePine size={16} />,
  family: <Baby size={16} />,
  shopping: <ShoppingBag size={16} />,
  gourmet: <UtensilsCrossed size={16} />,
  access: <Train size={16} />,
  cost: <Coins size={16} />,
  safety: <ShieldCheck size={16} />,
};

const TOTAL_CARDS = 15;

export default function SwipePage() {
  const router = useRouter();
  const [towns, setTowns] = useState<TownProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<TownProfile[]>([]);
  const [disliked, setDisliked] = useState<TownProfile[]>([]);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/town-profiles.json")
      .then((r) => r.json())
      .then((data: TownProfile[]) => {
        // Shuffle and pick TOTAL_CARDS
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setTowns(shuffled.slice(0, TOTAL_CARDS));
      });
  }, []);

  const currentTown = towns[currentIndex];
  const progress = (currentIndex / towns.length) * 100;
  const isComplete = currentIndex >= towns.length && towns.length > 0;

  function swipe(direction: "left" | "right") {
    if (!currentTown) return;

    setSwipeDir(direction);

    if (direction === "right") {
      setLiked((prev) => [...prev, currentTown]);
    } else {
      setDisliked((prev) => [...prev, currentTown]);
    }

    setTimeout(() => {
      setSwipeDir(null);
      setDragX(0);
      if (currentIndex + 1 >= towns.length) {
        // Save results and navigate
        const likedTowns = direction === "right"
          ? [...liked, currentTown]
          : liked;
        sessionStorage.setItem(
          "swipe_results",
          JSON.stringify({ liked: likedTowns, disliked: direction === "left" ? [...disliked, currentTown] : disliked })
        );
        router.push("/diagnosis/swipe/result");
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, 300);
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStart) return;
    const dx = e.touches[0].clientX - touchStart.x;
    setDragX(dx);
  }

  function handleTouchEnd() {
    if (Math.abs(dragX) > 80) {
      swipe(dragX > 0 ? "right" : "left");
    } else {
      setDragX(0);
    }
    setTouchStart(null);
  }

  if (towns.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-pulse text-3xl text-muted-foreground">...</div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-bounce"><PartyPopper size={48} className="mx-auto text-primary" /></div>
          <p className="text-muted-foreground">結果を分析中...</p>
        </div>
      </div>
    );
  }

  const rotation = dragX * 0.1;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 300);

  return (
    <div className="min-h-[80vh] flex flex-col p-4 max-w-sm mx-auto">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{currentIndex + 1} / {towns.length}</span>
          <span className="inline-flex items-center gap-1"><Heart size={12} className="text-pink-500 fill-pink-500" /> {liked.length} | <Hand size={12} /> {disliked.length}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Swipe indicators */}
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 transition-opacity"
          style={{ opacity: dragX < -30 ? Math.min(1, Math.abs(dragX) / 100) : 0 }}
        >
          <Hand size={36} />
        </div>
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity"
          style={{ opacity: dragX > 30 ? Math.min(1, dragX / 100) : 0 }}
        >
          <Heart size={36} className="text-pink-500 fill-pink-500" />
        </div>

        <div
          ref={cardRef}
          className={`w-full bg-card rounded-2xl shadow-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing transition-transform ${
            swipeDir === "right"
              ? "translate-x-[120%] rotate-12"
              : swipeDir === "left"
                ? "-translate-x-[120%] -rotate-12"
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
          {/* Town card content */}
          <div className="bg-gradient-to-br from-emerald-100 to-emerald-50 p-6 text-center">
            <h2 className="text-2xl font-bold mb-1">{currentTown.name}</h2>
            <p className="text-sm text-muted-foreground">{currentTown.pref}</p>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-center">{currentTown.description}</p>

            <div className="flex flex-wrap justify-center gap-2">
              {currentTown.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-muted text-xs px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground">2LDK家賃目安</div>
              <div className="text-lg font-bold text-primary">
                {(currentTown.rent2ldk / 10000).toFixed(1)}万円
              </div>
            </div>

            {/* Score highlights */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {Object.entries(currentTown.scores)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([key, val]) => {
                  return (
                    <div key={key}>
                      <div className="flex justify-center">{SCORE_ICON_MAP[key]}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {"★".repeat(val)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-8 mt-6 mb-4">
        <button
          onClick={() => swipe("left")}
          className="w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center active:scale-90 transition-transform bg-white shadow-md"
        >
          <Hand size={28} />
        </button>
        <button
          onClick={() => swipe("right")}
          className="w-16 h-16 rounded-full border-2 border-emerald-400 flex items-center justify-center active:scale-90 transition-transform bg-white shadow-md"
        >
          <Heart size={28} className="text-pink-500 fill-pink-500" />
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        スワイプ or ボタンで選んでね
      </p>
    </div>
  );
}
