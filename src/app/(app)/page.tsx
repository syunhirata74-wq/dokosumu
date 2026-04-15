"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { TownProfile } from "@/lib/diagnosis";
import type { Profile } from "@/types/database";
import Link from "next/link";
import { toast } from "sonner";
import { X, Heart, MapPin, Coins, SlidersHorizontal, Coffee, ShoppingBasket, Trees, Utensils, TrainFront, Hospital, Clock, ChevronUp, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

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

function MetricCell({
  Icon,
  value,
  label,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center bg-muted/40 rounded-xl py-2.5 px-1">
      <Icon size={16} className="text-primary mb-1" />
      <div className="text-sm font-bold leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function DetailDialogBody({
  town,
  commuteToWork,
  workplace,
  onClose,
  onDecide,
}: {
  town: TownProfile & { imageUrl?: string };
  commuteToWork: number | null;
  workplace: string | null;
  onClose: () => void;
  onDecide: (direction: "left" | "right") => void;
}) {
  const photos = town.photos && town.photos.length > 0 ? town.photos : town.imageUrl ? [town.imageUrl] : [];
  const [heroPhoto, setHeroPhoto] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [pullStart, setPullStart] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Swipe-down-to-close: only engages when content is scrolled to top
  function handleTouchStart(e: React.TouchEvent) {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      setPullStart(e.touches[0].clientY);
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (pullStart === null) return;
    const dy = e.touches[0].clientY - pullStart;
    if (dy > 0) setPullY(dy);
  }
  function handleTouchEnd() {
    if (pullY > 120) onClose();
    setPullY(0);
    setPullStart(null);
  }

  return (
    <div
      className="flex flex-col h-full bg-background transition-transform"
      style={{ transform: pullY > 0 ? `translateY(${Math.min(pullY, 300)}px)` : undefined }}
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-2 h-14 bg-background/95 backdrop-blur border-b">
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="w-12 h-12 flex items-center justify-center rounded-full active:bg-muted transition-colors"
        >
          <X size={24} />
        </button>
        <DialogTitle className="text-base font-semibold">{town.name}</DialogTitle>
        <div className="w-12 h-12" /> {/* spacer for symmetry */}
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pb-24"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Hero photo slider */}
        {photos.length > 0 && (
          <div className="relative h-64 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[heroPhoto]} alt={town.name} className="w-full h-full object-cover" />
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHeroPhoto(i)}
                    className={`h-1.5 rounded-full transition-all ${i === heroPhoto ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Header text */}
        <div className="px-4 py-4 border-b">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-2xl font-bold">{town.name}</h2>
            <span className="text-sm text-muted-foreground">{town.pref}</span>
          </div>
          {town.lineNames && town.lineNames.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">{town.lineNames.join("・")}</div>
          )}
          <p className="text-sm text-foreground mt-2 leading-relaxed">{town.description}</p>
        </div>

        <div className="px-4 py-5 space-y-6">

        {/* Commute to workplace */}
        {commuteToWork !== null && workplace && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Clock size={12} /> 通勤時間
            </h3>
            <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm">{workplace} まで</span>
              <span className="text-lg font-bold text-primary">{commuteToWork}分</span>
            </div>
          </section>
        )}

        {/* Major hub commutes */}
        {town.commuteHubs && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <TrainFront size={12} /> 主要駅までの所要時間
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(["渋谷", "新宿", "東京"] as const).map((hub) =>
                town.commuteHubs?.[hub] !== undefined ? (
                  <div key={hub} className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="text-xs text-muted-foreground">{hub}</div>
                    <div className="text-base font-bold">{town.commuteHubs[hub]}分</div>
                  </div>
                ) : null
              )}
            </div>
          </section>
        )}

        {/* Rent range (or fallback to single 2LDK) */}
        {town.rentRange ? (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Coins size={12} /> 家賃相場（賃貸マンション）
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(["1LDK", "2LDK", "3LDK"] as const).map((madori) =>
                town.rentRange?.[madori] !== undefined ? (
                  <div key={madori} className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="text-xs text-muted-foreground">{madori}</div>
                    <div className="text-base font-bold">
                      {(town.rentRange[madori]! / 10000).toFixed(0)}万
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </section>
        ) : (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Coins size={12} /> 家賃
            </h3>
            <div className="bg-muted/40 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm">2LDK</span>
              <span className="text-lg font-bold">
                {Math.round((town.rentAvg2LDK ?? town.rent2ldk) / 10000)}万円
              </span>
            </div>
          </section>
        )}

        {/* Indicator when detailed enrichment is pending */}
        {!town.commuteHubs && !town.lineNames && !town.topSpots && (
          <p className="text-[11px] text-center text-muted-foreground bg-muted/30 rounded-lg py-2.5 px-3">
            この駅の詳細情報は現在準備中です
          </p>
        )}

        {/* Rail lines */}
        {town.lineNames && town.lineNames.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <TrainFront size={12} /> 路線（{town.lineNames.length}本）
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {town.lineNames.map((l) => (
                <span key={l} className="bg-muted text-xs px-2.5 py-1 rounded-full">{l}</span>
              ))}
            </div>
          </section>
        )}

        {/* Top spots */}
        {town.topSpots && town.topSpots.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles size={12} /> 代表スポット
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {town.topSpots.map((s) => (
                <span key={s} className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* Facility counts */}
        {town.facilities && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">周辺データ</h3>
            <div className="grid grid-cols-3 gap-2">
              {town.facilities.cafe !== undefined && <Fact Icon={Coffee} label="カフェ" value={town.facilities.cafe} unit="件" />}
              {town.facilities.gourmet !== undefined && <Fact Icon={Utensils} label="グルメ" value={town.facilities.gourmet} unit="件" />}
              {town.facilities.supermarket !== undefined && <Fact Icon={ShoppingBasket} label="スーパー" value={town.facilities.supermarket} unit="件" />}
              {town.facilities.park !== undefined && <Fact Icon={Trees} label="公園" value={town.facilities.park} unit="個" />}
              {town.facilities.hospital !== undefined && <Fact Icon={Hospital} label="病院" value={town.facilities.hospital} unit="件" />}
            </div>
          </section>
        )}
        </div>
      </div>

      {/* Fixed bottom CTA bar */}
      <div className="sticky bottom-0 left-0 right-0 z-10 bg-background border-t px-4 py-3 flex gap-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button
          onClick={() => onDecide("left")}
          className="flex-1 h-12 rounded-full border-2 border-gray-300 bg-white font-semibold text-gray-500 active:scale-95 transition-transform flex items-center justify-center gap-1.5"
        >
          <X size={18} />
          後でいいかも
        </button>
        <button
          onClick={() => onDecide("right")}
          className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-semibold active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-md"
        >
          <Heart size={18} fill="currentColor" />
          行ってみたい
        </button>
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
  const [photoIndex, setPhotoIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [commuteToWork, setCommuteToWork] = useState<number | null>(null);

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

  // Reset photo carousel whenever we advance to a new town
  useEffect(() => {
    setPhotoIndex(0);
    setCommuteToWork(null);
  }, [currentIndex]);

  // Fetch commute from workplace → current town (session cache)
  useEffect(() => {
    const currentCode = filteredTowns[currentIndex]?.code;
    const currentName = filteredTowns[currentIndex]?.name;
    if (!profile?.workplace_station || !currentCode || !currentName) return;
    const cacheKey = `commute:${profile.workplace_station}:${currentCode}`;
    const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
    if (cached) {
      setCommuteToWork(parseInt(cached));
      return;
    }
    let cancelled = false;
    fetch(`/api/commute?from=${encodeURIComponent(profile.workplace_station)}&to=${encodeURIComponent(currentName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.minutes) {
          setCommuteToWork(data.minutes);
          sessionStorage.setItem(cacheKey, String(data.minutes));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentIndex, filteredTowns, profile?.workplace_station]);

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
        toast.success(`🎉 ${currentTown.name} でふたりとも行ってみたい！`);
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
        <h1 className="text-lg font-bold">町を探す</h1>
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
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 rounded-full px-3 py-2 text-sm font-semibold text-gray-400 border-2 border-gray-300 transition-opacity"
              style={{ opacity: dragX < -30 ? Math.min(1, Math.abs(dragX) / 100) : 0 }}>後でいいかも</div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 rounded-full px-3 py-2 text-sm font-semibold text-primary border-2 border-primary transition-opacity"
              style={{ opacity: dragX > 30 ? Math.min(1, dragX / 100) : 0 }}>行ってみたい</div>

            <div
              className={`w-full rounded-2xl shadow-xl overflow-hidden bg-card transition-all ${
                swipeDir === "right" ? "translate-x-[120%] rotate-12 opacity-0" : swipeDir === "left" ? "-translate-x-[120%] -rotate-12 opacity-0" : ""
              }`}
              style={!swipeDir ? { transform: `translateX(${dragX}px) rotate(${rotation}deg)`, transition: dragX === 0 ? "transform 0.3s" : "none" } : undefined}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Photo slider */}
              {(() => {
                const photoList = currentTown.photos && currentTown.photos.length > 0
                  ? currentTown.photos
                  : currentTown.imageUrl
                  ? [currentTown.imageUrl]
                  : [];
                const active = photoList[photoIndex] ?? photoList[0];
                return (
                  <div className="relative h-64 bg-gradient-to-br from-emerald-200 to-emerald-100">
                    {active && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={active} alt={currentTown.name} className="w-full h-full object-cover" loading="eager" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Photo dots */}
                    {photoList.length > 1 && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                        {photoList.map((_, i) => (
                          <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
                            className={`h-1 rounded-full transition-all ${i === photoIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
                            aria-label={`Photo ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Partner-already-LIKED badge */}
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
                        <span className="text-xs font-medium text-gray-800">も行ってみたい</span>
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <h2 className="text-2xl font-bold drop-shadow-lg leading-tight">{currentTown.name}</h2>
                      <div className="flex items-center gap-1 text-sm opacity-90 mt-0.5">
                        <MapPin size={14} />
                        <span>{currentTown.pref}</span>
                        {currentTown.lineNames && currentTown.lineNames.length > 0 && (
                          <span className="opacity-70">・{currentTown.lineNames.slice(0, 2).join("・")}{currentTown.lineNames.length > 2 ? " ほか" : ""}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Summary info */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{currentTown.description}</p>

                {/* Three-metric summary */}
                <div className="grid grid-cols-3 gap-2">
                  <MetricCell
                    Icon={Clock}
                    value={commuteToWork ? `${commuteToWork}分` : currentTown.commuteHubs?.["渋谷"] ? `渋谷${currentTown.commuteHubs["渋谷"]}分` : "—"}
                    label={commuteToWork ? "通勤" : "渋谷まで"}
                  />
                  <MetricCell
                    Icon={Coins}
                    value={`${Math.round((currentTown.rentAvg2LDK ?? currentTown.rent2ldk) / 10000)}万`}
                    label="2LDK家賃"
                  />
                  <MetricCell
                    Icon={TrainFront}
                    value={currentTown.lines ? `${currentTown.lines}本` : "—"}
                    label="路線"
                  />
                </div>

                {/* Detail trigger — opens a fullscreen modal */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailOpen(true);
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <ChevronUp size={14} />
                  詳細を見る
                </button>
                <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                  <DialogContent
                    showCloseButton={false}
                    className="!fixed !inset-0 !top-0 !left-0 !transform-none !max-w-full !w-full !h-full !rounded-none !p-0 !gap-0 !ring-0 flex flex-col"
                  >
                    <DetailDialogBody
                      town={currentTown}
                      commuteToWork={commuteToWork}
                      workplace={profile?.workplace_station ?? null}
                      onClose={() => setDetailOpen(false)}
                      onDecide={(direction) => {
                        setDetailOpen(false);
                        // small delay so the modal close animation runs first
                        setTimeout(() => swipe(direction), 150);
                      }}
                    />
                  </DialogContent>
                </Dialog>
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
