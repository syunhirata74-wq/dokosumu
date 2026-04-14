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
import dynamic from "next/dynamic";

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-2xl">🏠</div></div>;
  if (!town) return <div className="p-4 text-center text-muted-foreground">町が見つかりません</div>;

  const myRating = getMyRating();
  const iRecommended = recommendations.some((r) => r.user_id === user?.id);
  const bothRecommended = recommendations.length >= 2;
  const recommendedBy = recommendations.map((r) => members.find((m) => m.id === r.user_id)?.name).filter(Boolean);
  const rentAvg = rent?.rent_avg ?? 0;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <Link href="/" className="text-sm text-muted-foreground mb-2 inline-block">← 戻る</Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{town.name}</h1>
          <button onClick={deleteTown} className="text-xs text-muted-foreground px-2 py-1 border rounded-md">削除</button>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {town.station && <span>🚃 {town.station}</span>}
          {town.visited_at && <span>📅 {new Date(town.visited_at).toLocaleDateString("ja-JP")}</span>}
          {!town.visited && (
            <button onClick={markAsVisited} className="text-emerald-500 font-medium active:scale-95 transition-transform">
              📌 行きたい → タップで「行った」に
            </button>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <span className="font-semibold text-sm">
              {bothRecommended ? "💕 二人とも推し！" : recommendedBy.length > 0 ? `💗 ${recommendedBy[0]}が推し` : "推しの町にする？"}
            </span>
          </div>
          <button
            onClick={toggleRecommendation}
            className="text-2xl active:scale-90 transition-transform"
          >
            {iRecommended ? "💗" : "🤍"}
          </button>
        </CardContent>
      </Card>

      {/* Rating Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">評価</h2>
            <Link href={`/towns/${townId}/rate`}>
              <Button variant="outline" size="sm">{myRating ? "評価を修正" : "評価する"}</Button>
            </Link>
          </div>
          {ratings.length > 0 ? (
            <div className="space-y-2">
              {RATING_CATEGORIES.map((cat) => {
                const result = getAverageByCategory(cat.key);
                if (!result) return null;
                return (
                  <div key={cat.key} className="flex items-center gap-2">
                    <span className="text-sm w-6">{cat.icon}</span>
                    <span className="text-sm flex-1 min-w-0 truncate">{cat.label}</span>
                    <div className="flex items-center gap-1.5">
                      {result.values.map((v, i) => (
                        <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded" title={v.name}>{v.name.charAt(0)}: {v.value}</span>
                      ))}
                      <span className="text-sm font-semibold w-8 text-right">{result.avg.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">まだ評価がありません</p>
          )}
        </CardContent>
      </Card>

      {/* Rent */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">💰 家賃相場</h2>
            {town.station_code && (
              <Button variant="outline" size="sm" onClick={fetchRent} disabled={fetchingRent}>
                {fetchingRent ? "取得中..." : rent ? "更新" : "家賃を調べる"}
              </Button>
            )}
          </div>
          {rent && rent.rent_avg ? (
            <div className="space-y-2">
              <div className="text-center bg-muted rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">同棲向け家賃の目安</div>
                <div className="text-2xl font-bold text-primary">{formatYen(rent.rent_avg)}</div>
              </div>
              <div className="text-center text-xs text-muted-foreground">※ SUUMOの相場ページ（2LDK）より取得</div>
              {town.station_code && (
                <a href={`https://suumo.jp/chintai/soba/tokyo/ek_${town.station_code}/`} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-primary underline">SUUMOで相場を確認する</a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              {town.station_code ? "「家賃を調べる」で相場を取得できます" : "駅コードがない町は家賃を取得できません"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Moving Cost */}
      {rent && rent.rent_avg && rent.rent_avg > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">🚚 引っ越し初期費用</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: "敷金（0〜1ヶ月）", amount: 0 },
                { label: "礼金（1ヶ月）", amount: rentAvg },
                { label: "仲介手数料（0.5ヶ月）", amount: Math.round(rentAvg * 0.5) },
                { label: "前家賃（1ヶ月）", amount: rentAvg },
                { label: "火災保険", amount: 20000 },
                { label: "鍵交換", amount: 15000 },
                { label: "引っ越し業者（2人分）", amount: 80000 },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span>{formatYen(item.amount)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-base">
                <span>合計目安</span>
                <span className="text-primary">{formatYen(Math.round(rentAvg * 2.5) + 115000)}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">※ 概算です。敷金0の物件も多いです</p>
          </CardContent>
        </Card>
      )}

      {/* Commute */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">🚃 通勤チェック</h2>
            {members.some((m) => m.workplace_station) && town.station && !fetchingCommute && (
              <Button variant="outline" size="sm" onClick={() => {
                members.forEach((m) => {
                  if (m.workplace_station && town.station) {
                    fetchCommute(town.station, m.workplace_station, m.id);
                  }
                });
              }}>
                {Object.keys(commuteData).length > 0 ? "再検索" : "調べる"}
              </Button>
            )}
          </div>
          {!members.some((m) => m.workplace_station) ? (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground mb-2">職場の最寄り駅を設定すると通勤時間がわかります</p>
              <Link href="/settings">
                <Button variant="outline" size="sm">設定ページへ</Button>
              </Link>
            </div>
          ) : fetchingCommute ? (
            <p className="text-sm text-muted-foreground text-center py-2">検索中...</p>
          ) : Object.keys(commuteData).length > 0 ? (
            <div className="space-y-3">
              {members.filter((m) => m.workplace_station).map((m) => {
                const data = commuteData[m.id];
                if (!data) return null;
                return (
                  <div key={m.id} className="bg-muted rounded-lg p-3">
                    <div className="font-medium text-sm mb-1">{m.name}</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {town.station} → {m.workplace_station}
                    </div>
                    {data.minutes ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center mb-2">
                          <div>
                            <div className="text-lg font-bold text-primary">{data.minutes}分</div>
                            <div className="text-[10px] text-muted-foreground">所要時間</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold">{data.fare ? `${data.fare.toLocaleString()}円` : "-"}</div>
                            <div className="text-[10px] text-muted-foreground">交通費(片道)</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold">{data.fare ? `${(data.fare * 2 * 20).toLocaleString()}円` : "-"}</div>
                            <div className="text-[10px] text-muted-foreground">月額(概算)</div>
                          </div>
                        </div>
                        {data.transitUrl && (
                          <a href={data.transitUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-primary underline">Yahoo!路線でルートを見る</a>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">ルートが見つかりませんでした</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">「調べる」で通勤時間を検索</p>
          )}
        </CardContent>
      </Card>

      {/* Facilities */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">🗺️ 周辺施設</h2>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {FACILITY_TYPES.map((ft) => (
              <button
                key={ft.value}
                onClick={() => {
                  setSelectedFacilityTypes((prev) =>
                    prev.includes(ft.value) ? prev.filter((v) => v !== ft.value) : [...prev, ft.value]
                  );
                }}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-xs transition-colors ${
                  selectedFacilityTypes.includes(ft.value)
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border"
                }`}
              >
                <span className="text-base">{ft.icon}</span>
                <span className="text-[10px]">{ft.label}</span>
              </button>
            ))}
          </div>
          {selectedFacilityTypes.length > 0 && (
            <Button variant="outline" size="sm" className="w-full mb-3" onClick={fetchFacilitiesData} disabled={fetchingFacilities}>
              {fetchingFacilities ? "検索中..." : "周辺を検索"}
            </Button>
          )}
          {facilities.length > 0 && (
            <>
              <FacilityMap
                facilities={facilities}
                typeIcons={Object.fromEntries(FACILITY_TYPES.map((t) => [t.googleType, t.icon]))}
              />
              <div className="space-y-1.5 max-h-48 overflow-y-auto mt-3">
                {facilities.map((f, i) => {
                  const ft = FACILITY_TYPES.find((t) => t.googleType === f.type);
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0">
                      <span>{ft?.icon ?? "📍"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-xs">{f.name}</div>
                        {f.address && <div className="text-[10px] text-muted-foreground truncate">{f.address}</div>}
                      </div>
                      {f.rating && <span className="text-xs text-muted-foreground">★{f.rating}</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {facilities.length === 0 && selectedFacilityTypes.length > 0 && !fetchingFacilities && (
            <p className="text-xs text-muted-foreground text-center">施設を選択して「周辺を検索」を押してください</p>
          )}
        </CardContent>
      </Card>

      {/* Spots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">スポット</h2>
          <Link href={`/towns/${townId}/spots/new`}><Button variant="outline" size="sm">+ 追加</Button></Link>
        </div>
        {spots.length === 0 ? (
          <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">気になったスポットを追加しよう</CardContent></Card>
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
                      {spot.photo_url && <img src={spot.photo_url} alt={spot.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cat?.icon ?? "📍"}</span>
                          <span className="font-medium text-sm truncate">{spot.name}</span>
                        </div>
                        <Badge variant="secondary" className="mt-1 text-xs">{cat?.label ?? spot.category}</Badge>
                        {spot.memo && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{spot.memo}</p>}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <button onClick={() => toggleFavorite(spot.id)} className="active:scale-90 transition-transform">
                          <span className="text-xl">{bothFav ? "💕" : iMyFav ? "💗" : "🤍"}</span>
                        </button>
                        <button onClick={() => deleteSpot(spot.id)} className="text-[10px] text-muted-foreground">
                          ✕
                        </button>
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
          <h2 className="font-semibold mb-3">💬 感想</h2>
          {comments.length > 0 ? (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => {
                const member = members.find((m) => m.id === comment.user_id);
                const isMe = comment.user_id === user?.id;
                return (
                  <div key={comment.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    {member?.avatar_url ? (
                      <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">{member?.name?.charAt(0) ?? "?"}</div>
                    )}
                    <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>{comment.content}</div>
                      <div className="flex items-center gap-2 mt-0.5 px-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isMe && (
                          <button onClick={() => deleteComment(comment.id)} className="text-[10px] text-muted-foreground hover:text-destructive">
                            削除
                          </button>
                        )}
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
    </div>
  );
}
