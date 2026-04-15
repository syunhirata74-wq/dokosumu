"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { TownProfile } from "@/lib/diagnosis";
import type { Profile } from "@/types/database";
import Link from "next/link";
import { toast } from "sonner";
import { X, Heart, MapPin, Coins, SlidersHorizontal, Coffee, ShoppingBasket, Trees, Utensils, TrainFront, Hospital } from "lucide-react";

const PREF_OPTIONS = ["全て", "東京都", "神奈川県", "埼玉県", "千葉県"];
const RENT_OPTIONS = [
  { label: "上限なし", value: Infinity },
  { label: "〜10万", value: 100000 },
  { label: "〜15万", value: 150000 },
  { label: "〜20万", value: 200000 },
  { label: "〜25万", value: 250000 },
];

type Ambiance = "all" | "cafe" | "green" | "quiet" | "lively";
const AMBIANCE_OPTIONS: { key: Ambiance; label: string; emoji: string }[] = [
  { key: "all", label: "全て", emoji: "✨" },
  { key: "cafe", label: "カフェ多め", emoji: "☕" },
  { key: "green", label: "緑が多い", emoji: "🌳" },
  { key: "quiet", label: "静か", emoji: "🤫" },
  { key: "lively", label: "賑やか", emoji: "🌃" },
];

function matchesAmbiance(
  t: TownProfile,
  ambiance: Ambiance
): boolean {
  if (ambiance === "all") return true;
  if (ambiance === "cafe") return (t.facilities?.cafe ?? 0) >= 30 || t.scores.cafe >= 4;
  if (ambiance === "green") return (t.facilities?.park ?? 0) >= 4 || t.scores.nature >= 4;
  if (ambiance === "quiet") return t.scores.quiet >= 4;
  if (ambiance === "lively") return t.scores.nightlife >= 4;
  return true;
}

// Simple 32-bit hash → stable ordering across reloads (replaces Math.random shuffle).
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function Fact({
  Icon,
  label,
  value,
  unit,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={14} className="text-primary shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</div>
        <div className="text-sm font-semibold leading-none">
          {value}
          <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, profile } = useAuth();
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
  const [ambiance, setAmbiance] = useState<Ambiance>("all");
  const [partner, setPartner] = useState<Profile | null>(null);
  const [partnerLikes, setPartnerLikes] = useState<Set<string>>(new Set());
  const [mySwiped, setMySwiped] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/town-profiles.json")
      .then((r) => r.json())
      .then((data: TownProfile[]) => {
        setAllTowns(data);
        setLoading(false);
      });
  }, []);

  // Load partner profile + their LIKE history so we can show avatars on cards
  useEffect(() => {
    if (!profile?.couple_id || !user?.id) return;
    let cancelled = false;

    (async () => {
      const [partnerRes, likesRes, swipesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("couple_id", profile.couple_id!)
          .neq("id", user.id)
          .maybeSingle(),
        supabase
          .from("town_likes")
          .select("station_code, user_id")
          .eq("couple_id", profile.couple_id!),
        supabase
          .from("town_swipes")
          .select("station_code")
          .eq("couple_id", profile.couple_id!)
          .eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setPartner(partnerRes.data ?? null);
      const partnerCodes = new Set(
        (likesRes.data ?? [])
          .filter((r) => r.user_id !== user.id)
          .map((r) => r.station_code)
      );
      setPartnerLikes(partnerCodes);
      setMySwiped(new Set((swipesRes.data ?? []).map((r) => r.station_code)));
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.couple_id, user?.id]);

  // Deterministic hash so the same couple sees the same order across reloads.
  // Mixes station code with user id so couples don't all see stations in the same order.
  const seed = user?.id ?? "";
  const filteredTowns = useMemo(() => {
    let result = allTowns;
    if (prefFilter !== "全て") result = result.filter((t) => t.pref === prefFilter);
    if (rentLimit !== Infinity) result = result.filter((t) => t.rent2ldk <= rentLimit);
    if (ambiance !== "all") result = result.filter((t) => matchesAmbiance(t, ambiance));
    // Exclude stations the current user has already swiped (either direction)
    result = result.filter((t) => !mySwiped.has(t.code));
    return [...result].sort((a, b) => stableHash(a.code + seed) - stableHash(b.code + seed));
  }, [allTowns, prefFilter, rentLimit, ambiance, seed, mySwiped]);

  // Reset index when filters change
  useEffect(() => {
    setCurrentIndex(0);
    setLikedCount(0);
  }, [prefFilter, rentLimit, ambiance]);

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
    if (!currentTown || !profile?.couple_id || !user?.id) return;
    setSwipeDir(direction);

    const stationCode = currentTown.code;

    // Always record the swipe (for dedup + resumption)
    await supabase.from("town_swipes").upsert(
      {
        couple_id: profile.couple_id,
        station_code: stationCode,
        user_id: user.id,
        direction,
      },
      { onConflict: "couple_id,station_code,user_id" }
    );
    setMySwiped((s) => new Set(s).add(stationCode));

    if (direction === "right") {
      const partnerAlreadyLiked = partnerLikes.has(stationCode);

      // 1. Record own LIKE (dedupe via composite PK)
      await supabase.from("town_likes").insert({
        couple_id: profile.couple_id,
        station_code: stationCode,
        user_id: user.id,
      });

      // 2. Ensure a towns row exists for this couple/station (idempotent)
      const { data: existing } = await supabase
        .from("towns")
        .select("id")
        .eq("couple_id", profile.couple_id)
        .eq("station_code", stationCode)
        .maybeSingle();

      if (!existing) {
        await supabase.from("towns").insert({
          couple_id: profile.couple_id,
          name: currentTown.name + "エリア",
          station: currentTown.name + "駅",
          station_code: stationCode,
          visited: false,
          lat: 0,
          lng: 0,
        });
      }

      setLikedCount((c) => c + 1);

      if (partnerAlreadyLiked) {
        toast.success(`🎉 ${currentTown.name} でふたりともLIKE！`);
      } else {
        toast.success(`${currentTown.name} を候補に追加`);
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
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">雰囲気</label>
            <div className="flex flex-wrap gap-1.5">
              {AMBIANCE_OPTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAmbiance(a.key)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    ambiance === a.key ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {a.emoji} {a.label}
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
            <button onClick={() => { setPrefFilter("全て"); setRentLimit(Infinity); setAmbiance("all"); }} className="text-primary text-sm underline">
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

                {/* Partner-already-LIKED badge (LINE avatar) */}
                {partner && partnerLikes.has(currentTown.code) && (
                  <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 shadow-lg">
                    {partner.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={partner.avatar_url} alt={partner.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                        {partner.name?.charAt(0)}
                      </div>
                    )}
                    <span className="text-xs font-medium text-gray-800">もLIKEしてる</span>
                  </div>
                )}

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

                {/* Fact block — objective counts */}
                {(currentTown.facilities || currentTown.lines || currentTown.rentAvg2LDK) && (
                  <div className="grid grid-cols-3 gap-x-2 gap-y-2 bg-muted/40 rounded-lg p-3">
                    {currentTown.facilities?.cafe !== undefined && (
                      <Fact Icon={Coffee} label="カフェ" value={currentTown.facilities.cafe} unit="件" />
                    )}
                    {currentTown.facilities?.gourmet !== undefined && (
                      <Fact Icon={Utensils} label="グルメ" value={currentTown.facilities.gourmet} unit="件" />
                    )}
                    {currentTown.facilities?.supermarket !== undefined && (
                      <Fact Icon={ShoppingBasket} label="スーパー" value={currentTown.facilities.supermarket} unit="件" />
                    )}
                    {currentTown.facilities?.park !== undefined && (
                      <Fact Icon={Trees} label="公園" value={currentTown.facilities.park} unit="個" />
                    )}
                    {currentTown.facilities?.hospital !== undefined && (
                      <Fact Icon={Hospital} label="病院" value={currentTown.facilities.hospital} unit="件" />
                    )}
                    {currentTown.lines !== undefined && (
                      <Fact Icon={TrainFront} label="路線" value={currentTown.lines} unit="本" />
                    )}
                  </div>
                )}

                {/* Rent — prefer real average if present, else fallback */}
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">
                    2LDK {((currentTown.rentAvg2LDK ?? currentTown.rent2ldk) / 10000).toFixed(0)}万円
                    {currentTown.rentAvg2LDK !== undefined && (
                      <span className="text-xs text-muted-foreground ml-1">（相場平均）</span>
                    )}
                  </span>
                </div>

                {/* Tags — kept for personality but reduced */}
                <div className="flex flex-wrap gap-1.5">
                  {currentTown.tags.slice(0, 2).map((tag) => (
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
