"use client";
import { toast } from "sonner";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type {
  Town,
  Spot,
  Rating,
  Profile,
  TownComment,
  SpotFavorite,
  TownRent,
  TownRecommendation,
} from "@/types/database";
import {
  RATING_CATEGORIES,
  SPOT_CATEGORIES,
  FACILITY_TYPES,
} from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Train, Calendar, Pin, Heart, Coins, Truck, Map, MessageCircle, ShoppingCart, TreePine, UtensilsCrossed, Footprints, Plus } from "lucide-react";
import dynamic from "next/dynamic";

const RATING_ICON_MAP: Record<string, React.ReactNode> = {
  living_env: <Home size={16} />,
  transport: <Train size={16} />,
  shopping: <ShoppingCart size={16} />,
  nature: <TreePine size={16} />,
  dining: <UtensilsCrossed size={16} />,
  rent: <Coins size={16} />,
  overall: <Heart size={16} />,
};

const FacilityMap = dynamic(() => import("@/components/facility-map"), {
  ssr: false,
  loading: () => <div className="h-64 bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">地図を読み込み中...</div>,
});

export default function TownDetailPage() {
  const params = useParams();
  const townId = params.id as string;
  const router = useRouter();
  const { user, profile } = useAuth();
  const [town, setTown] = useState<Town | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [comments, setComments] = useState<TownComment[]>([]);
  const [favorites, setFavorites] = useState<SpotFavorite[]>([]);
  const [rent, setRent] = useState<TownRent | null>(null);
  const [recommendations, setRecommendations] = useState<TownRecommendation[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [fetchingRent, setFetchingRent] = useState(false);
  const [commuteData, setCommuteData] = useState<Record<string, any>>({});
  const [fetchingCommute, setFetchingCommute] = useState(false);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacilityTypes, setSelectedFacilityTypes] = useState<string[]>([]);
  const [fetchingFacilities, setFetchingFacilities] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [townId]);

  async function loadData() {
    const [townRes, spotsRes, ratingsRes, commentsRes, favoritesRes, rentRes, recsRes] =
      await Promise.all([
        supabase.from("towns").select("*").eq("id", townId).single(),
        supabase.from("spots").select("*").eq("town_id", townId).order("created_at", { ascending: false }),
        supabase.from("ratings").select("*").eq("town_id", townId),
        supabase.from("town_comments").select("*").eq("town_id", townId).order("created_at", { ascending: true }),
        supabase.from("spot_favorites").select("*"),
        supabase.from("town_rents").select("*").eq("town_id", townId).single(),
        supabase.from("town_recommendations").select("*").eq("town_id", townId),
      ]);

    setTown(townRes.data);
    setSpots(spotsRes.data ?? []);
    setRatings(ratingsRes.data ?? []);
    setComments(commentsRes.data ?? []);
    setFavorites(favoritesRes.data ?? []);
    setRent(rentRes.data);
    setRecommendations(recsRes.data ?? []);

    if (townRes.data?.couple_id) {
      const { data: profilesData } = await supabase
        .from("profiles").select("*").eq("couple_id", townRes.data.couple_id);
      setMembers(profilesData ?? []);
    }
    setLoading(false);
  }

  function getMyRating(): Rating | undefined {
    return ratings.find((r) => r.user_id === user?.id);
  }

  function getAverageByCategory(key: string) {
    if (ratings.length === 0) return null;
    const values = ratings.map((r) => ({
      name: members.find((m) => m.id === r.user_id)?.name ?? "?",
      value: r[key as keyof Rating] as number,
    }));
    const avg = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    return { avg, values };
  }

  async function toggleRecommendation() {
    if (!user) return;
    const existing = recommendations.find((r) => r.user_id === user.id);
    if (existing) {
      await supabase.from("town_recommendations").delete().eq("id", existing.id);
      setRecommendations(recommendations.filter((r) => r.id !== existing.id));
    } else {
      const { data } = await supabase
        .from("town_recommendations").insert({ town_id: townId, user_id: user.id }).select().single();
      if (data) setRecommendations([...recommendations, data]);
    }
  }

  async function sendComment() {
    if (!newComment.trim() || !user) return;
    setSendingComment(true);
    await supabase.from("town_comments").insert({ town_id: townId, user_id: user.id, content: newComment.trim() });
    setNewComment("");
    const { data } = await supabase.from("town_comments").select("*").eq("town_id", townId).order("created_at", { ascending: true });
    setComments(data ?? []);
    setSendingComment(false);
  }

  async function toggleFavorite(spotId: string) {
    if (!user) return;
    const existing = favorites.find((f) => f.spot_id === spotId && f.user_id === user.id);
    if (existing) {
      await supabase.from("spot_favorites").delete().eq("id", existing.id);
      setFavorites(favorites.filter((f) => f.id !== existing.id));
    } else {
      const { data } = await supabase.from("spot_favorites").insert({ spot_id: spotId, user_id: user.id }).select().single();
      if (data) setFavorites([...favorites, data]);
    }
  }

  async function fetchRent() {
    if (!town?.station_code) return;
    setFetchingRent(true);
    try {
      const res = await fetch(`/api/rent?code=${town.station_code}`);
      const data = await res.json();
      if (data.rent_avg === null || data.error) {
        toast.error("家賃データが見つかりませんでした");
        setFetchingRent(false);
        return;
      }
      const { data: saved } = await supabase
        .from("town_rents").upsert({ town_id: townId, rent_avg: data.rent_avg }, { onConflict: "town_id" }).select().single();
      setRent(saved);
    } catch { toast.error("家賃データの取得に失敗しました"); }
    setFetchingRent(false);
  }

  async function fetchCommute(fromStation: string, toStation: string, memberId: string) {
    setFetchingCommute(true);
    try {
      const res = await fetch(`/api/commute?from=${encodeURIComponent(fromStation)}&to=${encodeURIComponent(toStation)}`);
      const data = await res.json();
      setCommuteData((prev) => ({ ...prev, [memberId]: data }));
    } catch { /* ignore */ }
    setFetchingCommute(false);
  }

  async function fetchFacilitiesData() {
    if (selectedFacilityTypes.length === 0 || !town?.station) return;
    setFetchingFacilities(true);
    try {
      const types = selectedFacilityTypes.join(",");
      const res = await fetch(`/api/facilities?station=${encodeURIComponent(town.station)}&types=${types}`);
      const data = await res.json();
      if (data.error) {
        if (res.status === 503) {
          toast.error("施設データの取得に失敗しました");
        } else {
          toast.error("施設データの取得に失敗しました");
        }
      } else {
        setFacilities(data.facilities ?? []);
      }
    } catch { toast.error("施設データの取得に失敗しました"); }
    setFetchingFacilities(false);
  }

  async function deleteTown() {
    if (!confirm(`「${town?.name}」を削除しますか？`)) return;
    await supabase.from("towns").delete().eq("id", townId);
    router.push("/");
  }

  async function markAsVisited() {
    await supabase.from("towns").update({ visited: true, visited_at: new Date().toISOString().split("T")[0] }).eq("id", townId);
    toast.success("行った町に変更しました！");
    loadData();
  }

  async function deleteSpot(spotId: string) {
    if (!confirm("このスポットを削除しますか？")) return;
    await supabase.from("spots").delete().eq("id", spotId);
    setSpots(spots.filter((s) => s.id !== spotId));
    toast.success("スポットを削除しました");
  }

  async function deleteComment(commentId: string) {
    await supabase.from("town_comments").delete().eq("id", commentId);
    setComments(comments.filter((c) => c.id !== commentId));
    toast.success("コメントを削除しました");
  }

  function formatYen(yen: number): string {
    return `${(yen / 10000).toFixed(1)}万円`;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse"><Home size={28} /></div></div>;
  if (!town) return <div className="p-4 text-center text-muted-foreground">町が見つかりません</div>;

  const me = members.find((m) => m.id === user?.id);
  const partner = members.find((m) => m.id !== user?.id);
  const myRating = getMyRating();
  const partnerRating = partner ? ratings.find((r) => r.user_id === partner.id) : undefined;
  const iRecommended = recommendations.some((r) => r.user_id === user?.id);
  const bothRecommended = recommendations.length >= 2;
  const recommendedBy = recommendations.map((r) => members.find((m) => m.id === r.user_id)?.name).filter(Boolean);
  const rentAvg = rent?.rent_avg ?? 0;

  // Step progress
  const hasVisited = town.visited;
  const bothRated = !!myRating && !!partnerRating;
  const stepsDone = [true, hasVisited, !!myRating, comments.some((c) => c.user_id === user?.id)].filter(Boolean).length;

  function MiniAvatar({ p, size = 24 }: { p: Profile; size?: number }) {
    return p.avatar_url
      ? <img src={p.avatar_url} alt={p.name} className="rounded-full object-cover" style={{ width: size, height: size }} />
      : <div className="rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold" style={{ width: size, height: size }}>{p.name?.charAt(0)}</div>;
  }

  return (
    <div className="pb-20">
      {/* Hero header */}
      <div className="relative bg-gradient-to-br from-emerald-200 to-emerald-50 p-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/matches" className="text-sm text-muted-foreground">← 戻る</Link>
          <button onClick={deleteTown} className="text-xs text-muted-foreground px-2 py-1 border rounded-md bg-white/50">削除</button>
        </div>
        <h1 className="text-2xl font-bold">{town.name}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {town.station && <span className="flex items-center gap-1"><Train size={14} /> {town.station}</span>}
          {town.visited_at && <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(town.visited_at).toLocaleDateString("ja-JP")}</span>}
        </div>
        {/* Recommend */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs">
            {bothRecommended ? "二人とも推し！" : recommendedBy.length > 0 ? `${recommendedBy[0]}が推し` : ""}
          </span>
          <button onClick={toggleRecommendation} className="active:scale-90 transition-transform">
            <Heart size={24} className={iRecommended ? "text-red-500" : "text-gray-300"} fill={iRecommended ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 space-y-4">
      <Tabs defaultValue="research">
        <TabsList className="w-full">
          <TabsTrigger value="research" className="flex-1 text-xs">調べる</TabsTrigger>
          <TabsTrigger value="record" className="flex-1 text-xs">記録する</TabsTrigger>
          <TabsTrigger value="overview" className="flex-1 text-xs">評価する</TabsTrigger>
        </TabsList>

        {/* === 評価するタブ === */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Two-person rating */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">二人の評価</h2>
                <Link href={`/towns/${townId}/rate`}>
                  <Button variant="outline" size="sm">{myRating ? "修正する" : "評価する"}</Button>
                </Link>
              </div>
              {ratings.length > 0 ? (
                <div className="space-y-2">
                  {/* Avatar header */}
                  <div className="flex items-center justify-end gap-2 mb-1">
                    {me && <div className="w-14 text-center"><MiniAvatar p={me} size={20} /><div className="text-[9px] text-muted-foreground mt-0.5">{me.name}</div></div>}
                    {partner && <div className="w-14 text-center"><MiniAvatar p={partner} size={20} /><div className="text-[9px] text-muted-foreground mt-0.5">{partner.name}</div></div>}
                    <div className="w-8 text-center text-[9px] text-muted-foreground">平均</div>
                  </div>
                  {RATING_CATEGORIES.map((cat) => {
                    const result = getAverageByCategory(cat.key);
                    if (!result) return null;
                    const myVal = myRating ? (myRating[cat.key as keyof Rating] as number) : null;
                    const partnerVal = partnerRating ? (partnerRating[cat.key as keyof Rating] as number) : null;
                    return (
                      <div key={cat.key} className="flex items-center gap-1">
                        <span className="w-5 text-muted-foreground">{RATING_ICON_MAP[cat.key]}</span>
                        <span className="text-xs flex-1 min-w-0 truncate">{cat.label}</span>
                        <div className="w-14 text-center text-sm font-medium">{myVal ?? "-"}</div>
                        <div className="w-14 text-center text-sm font-medium">{partnerVal ?? "-"}</div>
                        <div className="w-8 text-center text-sm font-bold text-primary">{result.avg.toFixed(1)}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">まだ評価がありません</p>
                  <Link href={`/towns/${townId}/rate`}><Button size="sm">評価する</Button></Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === 調べるタブ === */}
        <TabsContent value="research" className="mt-4 space-y-4">
          {/* Rent */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-1"><Coins size={16} /> 家賃相場</h2>
                {town.station_code && (
                  <Button variant="outline" size="sm" onClick={fetchRent} disabled={fetchingRent}>
                    {fetchingRent ? "取得中..." : rent ? "更新" : "調べる"}
                  </Button>
                )}
              </div>
              {rent && rent.rent_avg ? (
                <div className="text-center bg-muted rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">2LDK目安</div>
                  <div className="text-2xl font-bold text-primary">{formatYen(rent.rent_avg)}</div>
                  {town.station_code && <a href={`https://suumo.jp/chintai/soba/tokyo/ek_${town.station_code}/`} target="_blank" className="text-xs text-primary underline mt-1 block">SUUMOで確認</a>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">{town.station_code ? "「調べる」で家賃を取得" : "駅コードがありません"}</p>
              )}
            </CardContent>
          </Card>

          {/* Moving cost */}
          {rent && rent.rent_avg && rentAvg > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="font-semibold text-sm flex items-center gap-1 mb-3"><Truck size={16} /> 引越し初期費用</h2>
                <div className="space-y-1.5 text-sm">
                  {[
                    { label: "敷金（0〜1ヶ月）", amount: 0 },
                    { label: "礼金（1ヶ月）", amount: rentAvg },
                    { label: "仲介手数料（0.5ヶ月）", amount: Math.round(rentAvg * 0.5) },
                    { label: "前家賃（1ヶ月）", amount: rentAvg },
                    { label: "火災保険", amount: 20000 },
                    { label: "鍵交換", amount: 15000 },
                    { label: "引越し業者（2人分）", amount: 80000 },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between"><span className="text-muted-foreground text-xs">{item.label}</span><span className="text-xs">{formatYen(item.amount)}</span></div>
                  ))}
                  <div className="border-t pt-1.5 flex justify-between font-bold">
                    <span>合計目安</span><span className="text-primary">{formatYen(Math.round(rentAvg * 2.5) + 115000)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Commute */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-1"><Train size={16} /> 通勤</h2>
                {members.some((m) => m.workplace_station) && town.station && !fetchingCommute && (
                  <Button variant="outline" size="sm" onClick={() => { members.forEach((m) => { if (m.workplace_station && town.station) fetchCommute(town.station, m.workplace_station, m.id); }); }}>
                    {Object.keys(commuteData).length > 0 ? "再検索" : "調べる"}
                  </Button>
                )}
              </div>
              {!members.some((m) => m.workplace_station) ? (
                <div className="text-center py-2"><p className="text-xs text-muted-foreground mb-2">職場駅を設定すると通勤時間がわかります</p><Link href="/settings"><Button variant="outline" size="sm">設定へ</Button></Link></div>
              ) : fetchingCommute ? (
                <p className="text-xs text-muted-foreground text-center py-2">検索中...</p>
              ) : Object.keys(commuteData).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {members.filter((m) => m.workplace_station).map((m) => {
                    const data = commuteData[m.id];
                    if (!data) return null;
                    return (
                      <div key={m.id} className="bg-muted rounded-lg p-3 text-center">
                        <MiniAvatar p={m} size={20} />
                        <div className="text-xs text-muted-foreground mt-1">{m.name}</div>
                        {data.minutes ? (
                          <>
                            <div className="text-lg font-bold text-primary mt-1">{data.minutes}分</div>
                            <div className="text-[10px] text-muted-foreground">{data.fare ? `${data.fare.toLocaleString()}円` : ""}</div>
                          </>
                        ) : <div className="text-xs text-muted-foreground mt-1">ルート不明</div>}
                        {data.transitUrl && <a href={data.transitUrl} target="_blank" className="text-[10px] text-primary underline mt-1 block">詳細</a>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">「調べる」で通勤時間を検索</p>
              )}
            </CardContent>
          </Card>

          {/* Facilities */}
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-sm flex items-center gap-1 mb-3"><Map size={16} /> 周辺施設</h2>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {FACILITY_TYPES.map((ft) => (
                  <button key={ft.value} onClick={() => setSelectedFacilityTypes((prev) => prev.includes(ft.value) ? prev.filter((v) => v !== ft.value) : [...prev, ft.value])}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] transition-colors ${selectedFacilityTypes.includes(ft.value) ? "border-primary bg-primary/5 text-primary font-medium" : "border-border"}`}>
                    <span className="text-sm">{ft.icon}</span><span>{ft.label}</span>
                  </button>
                ))}
              </div>
              {selectedFacilityTypes.length > 0 && <Button variant="outline" size="sm" className="w-full mb-3" onClick={fetchFacilitiesData} disabled={fetchingFacilities}>{fetchingFacilities ? "検索中..." : "検索"}</Button>}
              {facilities.length > 0 && (
                <>
                  <FacilityMap facilities={facilities} typeIcons={Object.fromEntries(FACILITY_TYPES.map((t) => [t.googleType, t.icon]))} />
                  <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
                    {facilities.map((f, i) => {
                      const ft = FACILITY_TYPES.find((t) => t.googleType === f.type);
                      return (<div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0"><span>{ft?.icon ?? "📍"}</span><span className="flex-1 truncate">{f.name}</span>{f.rating && <span className="text-muted-foreground">★{f.rating}</span>}</div>);
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === 記録タブ === */}
        <TabsContent value="record" className="mt-4 space-y-4">
          {/* Spots */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">スポット</h2>
              <Link href={`/towns/${townId}/spots/new`}><Button variant="outline" size="sm"><Plus size={14} className="mr-1" />追加</Button></Link>
            </div>
            {spots.length === 0 ? (
              <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">散歩中に気になったスポットを追加しよう</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {spots.map((spot) => {
                  const cat = SPOT_CATEGORIES.find((c) => c.value === spot.category);
                  const spotFavs = favorites.filter((f) => f.spot_id === spot.id);
                  const iMyFav = spotFavs.some((f) => f.user_id === user?.id);
                  const bothFav = spotFavs.length >= 2;
                  return (
                    <Card key={spot.id}>
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                          {spot.photo_url && <img src={spot.photo_url} alt={spot.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm truncate block">{spot.name}</span>
                            <Badge variant="secondary" className="mt-0.5 text-[10px]">{cat?.label ?? spot.category}</Badge>
                            {spot.memo && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{spot.memo}</p>}
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <button onClick={() => toggleFavorite(spot.id)} className="active:scale-90 transition-transform">
                              <Heart size={18} className={bothFav || iMyFav ? "text-red-400" : "text-gray-300"} fill={bothFav || iMyFav ? "currentColor" : "none"} />
                            </button>
                            <button onClick={() => deleteSpot(spot.id)} className="text-[9px] text-muted-foreground">✕</button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comments */}
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-sm flex items-center gap-1 mb-3"><MessageCircle size={16} /> 感想</h2>
              {comments.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {comments.map((comment) => {
                    const member = members.find((m) => m.id === comment.user_id);
                    const isMe = comment.user_id === user?.id;
                    return (
                      <div key={comment.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        {member && <MiniAvatar p={member} size={28} />}
                        <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                          <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>{comment.content}</div>
                          <div className="flex items-center gap-2 mt-0.5 px-1">
                            <span className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            {isMe && <button onClick={() => deleteComment(comment.id)} className="text-[10px] text-muted-foreground hover:text-destructive">削除</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2 mb-4">まだ感想がありません</p>
              )}
              <div className="flex gap-2">
                <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="感想を書く..." className="h-10 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }} />
                <Button size="sm" onClick={sendComment} disabled={sendingComment || !newComment.trim()} className="h-10 px-4">{sendingComment ? "..." : "送信"}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
