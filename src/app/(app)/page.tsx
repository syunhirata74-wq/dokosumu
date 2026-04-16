"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { TownProfile } from "@/lib/diagnosis";
import type { Profile } from "@/types/database";
import Link from "next/link";
import { toast } from "sonner";
import { X, Heart, MapPin, Coins, SlidersHorizontal, TrainFront, Clock, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TownDetailContent, MetricCell } from "@/components/town-detail";

const PREF_OPTIONS = ["全て", "東京都", "神奈川県", "埼玉県", "千葉県"];

type Madori = "1LDK" | "2LDK" | "3LDK";
const RENT_OPTIONS_BY_MADORI: Record<Madori, { label: string; value: number }[]> = {
  "1LDK": [
    { label: "上限なし", value: Infinity },
    { label: "〜10万", value: 100000 },
    { label: "〜15万", value: 150000 },
    { label: "〜20万", value: 200000 },
  ],
  "2LDK": [
    { label: "上限なし", value: Infinity },
    { label: "〜15万", value: 150000 },
    { label: "〜20万", value: 200000 },
    { label: "〜25万", value: 250000 },
    { label: "〜30万", value: 300000 },
  ],
  "3LDK": [
    { label: "上限なし", value: Infinity },
    { label: "〜20万", value: 200000 },
    { label: "〜30万", value: 300000 },
    { label: "〜40万", value: 400000 },
  ],
};

const COMMUTE_OPTIONS = [
  { label: "指定なし", value: null as number | null },
  { label: "〜15分", value: 15 },
  { label: "〜30分", value: 30 },
  { label: "〜45分", value: 45 },
  { label: "〜60分", value: 60 },
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
  const [rentLimits, setRentLimits] = useState<Record<Madori, number>>({
    "1LDK": Infinity,
    "2LDK": Infinity,
    "3LDK": Infinity,
  });
  const [ambiance, setAmbiance] = useState<Ambiance>("all");
  const [commuteLimit, setCommuteLimit] = useState<number | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [commuteMap, setCommuteMap] = useState<Record<string, number>>({});
  const [selectedHubs, setSelectedHubs] = useState<Set<"東京" | "渋谷" | "新宿">>(new Set());
  const [hubLimit, setHubLimit] = useState<number | null>(null);
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
  // Collect unique line names, grouped: major companies stay by company,
  // minor/local lines grouped by prefecture.
  const linesByCompany = useMemo(() => {
    // Only the 6 largest companies keep company-grouping. Everything else
    // (京急, 東武, 西武, 相鉄, 京成, ゆりかもめ, etc.) is grouped by prefecture.
    const MAJOR_COMPANIES = ["JR", "東京メトロ", "都営", "東急", "小田急", "京王"];
    const getMajor = (line: string): string | null => {
      if (line.startsWith("JR")) return "JR";
      if (line.startsWith("東京メトロ")) return "東京メトロ";
      if (line.startsWith("都営")) return "都営";
      for (const m of ["東急", "小田急", "京王"]) {
        if (line.startsWith(m)) return m;
      }
      return null;
    };

    // line → set of prefectures where it's present
    const linePrefs: Record<string, Set<string>> = {};
    for (const t of allTowns) {
      if (!t.lineNames) continue;
      for (const l of t.lineNames) {
        if (!linePrefs[l]) linePrefs[l] = new Set();
        linePrefs[l].add(t.pref);
      }
    }

    const groups: Record<string, string[]> = {};
    for (const line of Object.keys(linePrefs)) {
      const major = getMajor(line);
      if (major) {
        if (!groups[major]) groups[major] = [];
        groups[major].push(line);
      } else {
        // Minor/local line: scatter across every prefecture it appears in
        for (const p of linePrefs[line]) {
          if (!groups[p]) groups[p] = [];
          groups[p].push(line);
        }
      }
    }

    // Display order: major companies first, then prefectures
    const order = [
      ...MAJOR_COMPANIES,
      "東京都",
      "神奈川県",
      "埼玉県",
      "千葉県",
    ];
    const ordered = order
      .filter((k) => groups[k]?.length)
      .map((k) => ({ company: k, lines: groups[k].sort() }));
    for (const k of Object.keys(groups)) {
      if (!order.includes(k)) ordered.push({ company: k, lines: groups[k].sort() });
    }
    return ordered;
  }, [allTowns]);
  const knownLinesCount = useMemo(() => linesByCompany.reduce((n, g) => n + g.lines.length, 0), [linesByCompany]);

  const filteredTowns = useMemo(() => {
    let result = allTowns;

    // 都道府県
    if (prefFilter !== "全て") result = result.filter((t) => t.pref === prefFilter);

    // 間取り別 家賃上限（rentRange があればそれ、なければ rent2ldk を 2LDK として扱う）
    result = result.filter((t) => {
      for (const madori of ["1LDK", "2LDK", "3LDK"] as Madori[]) {
        const limit = rentLimits[madori];
        if (limit === Infinity) continue;
        const value =
          t.rentRange?.[madori] ??
          (madori === "2LDK" ? (t.rentAvg2LDK ?? t.rent2ldk) : undefined);
        // If we don't have the data for this madori, skip the check (don't filter out)
        if (value !== undefined && value > limit) return false;
      }
      return true;
    });

    // 路線（指定があれば、町の lineNames と重複する場合のみ残す。lineNames 無しは対象外）
    if (selectedLines.size > 0) {
      result = result.filter((t) => {
        if (!t.lineNames) return false;
        return t.lineNames.some((l) => selectedLines.has(l));
      });
    }

    // 通勤時間（勤務駅からの commute、既に取得済のキャッシュのみ対象）
    if (commuteLimit !== null) {
      result = result.filter((t) => {
        const mins = commuteMap[t.code];
        if (mins === undefined) return true; // 未計測は通す（徐々にキャッシュ貯まる）
        return mins <= commuteLimit;
      });
    }

    // 主要駅までの所要時間
    //  - ハブ指定あり: 選択ハブのどれか1つが時間以内
    //  - ハブ指定なし: 東京/渋谷/新宿のどれか1つが時間以内
    if (hubLimit !== null) {
      const hubsToCheck: ("東京" | "渋谷" | "新宿")[] =
        selectedHubs.size > 0 ? [...selectedHubs] : ["東京", "渋谷", "新宿"];
      result = result.filter((t) => {
        if (!t.commuteHubs) return false;
        for (const hub of hubsToCheck) {
          const m = t.commuteHubs[hub];
          if (m !== undefined && m <= hubLimit) return true;
        }
        return false;
      });
    }

    // 雰囲気
    if (ambiance !== "all") result = result.filter((t) => matchesAmbiance(t, ambiance));

    // スワイプ済み除外
    result = result.filter((t) => !mySwiped.has(t.code));

    return [...result].sort((a, b) => stableHash(a.code + seed) - stableHash(b.code + seed));
  }, [allTowns, prefFilter, rentLimits, selectedLines, commuteLimit, commuteMap, selectedHubs, hubLimit, ambiance, seed, mySwiped]);

  // Reset index when filters change
  useEffect(() => {
    setCurrentIndex(0);
    setLikedCount(0);
  }, [prefFilter, rentLimits, ambiance, commuteLimit, selectedLines, selectedHubs, hubLimit]);

  // Reset photo carousel whenever we advance to a new town
  useEffect(() => {
    setPhotoIndex(0);
    setCommuteToWork(null);
  }, [currentIndex]);

  // Restore commuteMap from sessionStorage cache on mount
  useEffect(() => {
    if (typeof sessionStorage === "undefined" || !profile?.workplace_station) return;
    const prefix = `commute:${profile.workplace_station}:`;
    const map: Record<string, number> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        const code = key.slice(prefix.length);
        const val = parseInt(sessionStorage.getItem(key) ?? "");
        if (!isNaN(val)) map[code] = val;
      }
    }
    setCommuteMap(map);
  }, [profile?.workplace_station]);

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
          setCommuteMap((prev) => ({ ...prev, [currentCode]: data.minutes }));
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

      {/* Filters — fullscreen modal */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent fullscreen showCloseButton={false}>
          <div className="flex flex-col h-full bg-background">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-2 h-14 bg-background/95 backdrop-blur border-b">
              <button
                onClick={() => setShowFilters(false)}
                aria-label="閉じる"
                className="w-12 h-12 flex items-center justify-center rounded-full active:bg-muted transition-colors"
              >
                <X size={24} />
              </button>
              <DialogTitle className="text-base font-semibold">絞り込み</DialogTitle>
              <div className="w-12 h-12" />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-24">
          {/* 📍 場所 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1">📍 場所</h3>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">エリア</label>
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

            {profile?.workplace_station && (
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">
                  通勤時間（{profile.workplace_station}駅まで）
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMUTE_OPTIONS.map((o) => (
                    <button
                      key={o.label}
                      onClick={() => setCommuteLimit(o.value)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                        commuteLimit === o.value ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {commuteLimit !== null && Object.keys(commuteMap).length < 5 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ※ スワイプして表示した町から順に通勤時間を取得します
                  </p>
                )}
              </div>
            )}

            {/* 主要駅までの所要時間 */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">
                主要駅までの所要時間
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {(["東京", "渋谷", "新宿"] as const).map((hub) => {
                  const active = selectedHubs.has(hub);
                  return (
                    <button
                      key={hub}
                      onClick={() =>
                        setSelectedHubs((prev) => {
                          const next = new Set(prev);
                          if (next.has(hub)) next.delete(hub);
                          else next.add(hub);
                          return next;
                        })
                      }
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {hub}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "指定なし", value: null as number | null },
                  { label: "〜15分", value: 15 },
                  { label: "〜30分", value: 30 },
                  { label: "〜45分", value: 45 },
                  { label: "〜60分", value: 60 },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setHubLimit(o.value)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      hubLimit === o.value ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {hubLimit !== null && selectedHubs.size === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  ※ 東京/渋谷/新宿のどれか1つでもこの時間内に着ける町
                </p>
              )}
            </div>

            {knownLinesCount > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-muted-foreground">路線</label>
                  {selectedLines.size > 0 && (
                    <button
                      onClick={() => setSelectedLines(new Set())}
                      className="text-[11px] text-primary underline"
                    >
                      {selectedLines.size}件クリア
                    </button>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/20 max-h-72 overflow-y-auto">
                  {linesByCompany.map((g) => (
                    <div key={g.company} className="p-2 border-b last:border-b-0">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">
                        {g.company}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.lines.map((l) => {
                          const active = selectedLines.has(l);
                          return (
                            <button
                              key={l}
                              onClick={() => {
                                setSelectedLines((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(l)) next.delete(l);
                                  else next.add(l);
                                  return next;
                                });
                              }}
                              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                                active ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}
                            >
                              {l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="h-px bg-border" />

          {/* 💰 予算（間取り別） */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">💰 予算（家賃上限）</h3>
            {(Object.keys(RENT_OPTIONS_BY_MADORI) as Madori[]).map((madori) => (
              <div key={madori}>
                <label className="text-[11px] text-muted-foreground mb-1 block">{madori}</label>
                <div className="flex flex-wrap gap-1.5">
                  {RENT_OPTIONS_BY_MADORI[madori].map((r) => (
                    <button
                      key={r.label}
                      onClick={() => setRentLimits((prev) => ({ ...prev, [madori]: r.value }))}
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                        rentLimits[madori] === r.value ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <div className="h-px bg-border" />

          {/* 🏙 雰囲気 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">🏙 雰囲気</h3>
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
          </section>
            </div>

            {/* Fixed footer: reset + apply */}
            <div className="sticky bottom-0 left-0 right-0 z-10 bg-background border-t px-4 py-3 flex gap-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <button
                onClick={() => {
                  setPrefFilter("全て");
                  setRentLimits({ "1LDK": Infinity, "2LDK": Infinity, "3LDK": Infinity });
                  setAmbiance("all");
                  setCommuteLimit(null);
                  setSelectedLines(new Set());
                  setSelectedHubs(new Set());
                  setHubLimit(null);
                }}
                className="flex-1 h-12 rounded-full border-2 border-gray-300 bg-white font-semibold text-gray-600 active:scale-95 transition-transform"
              >
                リセット
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-semibold active:scale-95 transition-transform shadow-md"
              >
                {filteredTowns.length}件を見る
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* No results */}
      {noResults && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground text-sm">条件に合う町がありません</p>
            <button
              onClick={() => {
                setPrefFilter("全て");
                setRentLimits({ "1LDK": Infinity, "2LDK": Infinity, "3LDK": Infinity });
                setAmbiance("all");
                setCommuteLimit(null);
                setSelectedLines(new Set());
              }}
              className="text-primary text-sm underline"
            >
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
                // Only use first 2 photos (station/area shots); skip facility interiors (index 2+)
                const allPhotos = currentTown.photos && currentTown.photos.length > 0
                  ? currentTown.photos
                  : currentTown.imageUrl
                  ? [currentTown.imageUrl]
                  : [];
                const photoList = allPhotos.slice(0, 2);
                const active = photoList[photoIndex] ?? photoList[0];
                return (
                  <div className="relative h-64 bg-gradient-to-br from-emerald-200 to-emerald-100">
                    {active && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={active} alt={currentTown.name} className="w-full h-full object-cover" loading="eager" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Tap left/right half to change photo */}
                    {photoList.length > 1 && (
                      <>
                        <button
                          className="absolute inset-y-0 left-0 w-1/3 z-20"
                          onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => (i - 1 + photoList.length) % photoList.length); }}
                          aria-label="前の写真"
                        />
                        <button
                          className="absolute inset-y-0 right-0 w-1/3 z-20"
                          onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => (i + 1) % photoList.length); }}
                          aria-label="次の写真"
                        />
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 pointer-events-none">
                          {photoList.map((_, i) => (
                            <div key={i} className={`h-1 rounded-full transition-all ${i === photoIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
                          ))}
                        </div>
                      </>
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
                    value={(() => {
                      if (commuteToWork) return `${commuteToWork}分`;
                      const hubs = currentTown.commuteHubs;
                      if (!hubs) return "—";
                      let mins = Infinity;
                      for (const h of ["東京", "渋谷", "新宿"] as const) {
                        if (hubs[h] !== undefined && hubs[h]! < mins) mins = hubs[h]!;
                      }
                      return mins === Infinity ? "—" : `${mins}分`;
                    })()}
                    label={(() => {
                      if (commuteToWork) return "勤務先まで";
                      const hubs = currentTown.commuteHubs;
                      if (!hubs) return "主要駅まで";
                      let best: string | null = null;
                      let mins = Infinity;
                      for (const h of ["東京", "渋谷", "新宿"] as const) {
                        if (hubs[h] !== undefined && hubs[h]! < mins) {
                          mins = hubs[h]!;
                          best = h;
                        }
                      }
                      return best ? `${best}まで` : "主要駅まで";
                    })()}
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
                  className="w-full h-11 flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full border-2 border-primary bg-primary/5 text-primary active:scale-[0.98] active:bg-primary/10 transition-all"
                >
                  <ChevronUp size={16} />
                  詳細を見る
                </button>
                <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                  <DialogContent fullscreen showCloseButton={false}>
                    <TownDetailContent
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
