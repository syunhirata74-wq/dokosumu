"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Town, Rating } from "@/types/database";
import { RATING_CATEGORIES } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TownWithRatings = Town & { ratings: Rating[] };

export default function HomePage() {
  const { profile } = useAuth();
  const [towns, setTowns] = useState<TownWithRatings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.couple_id) {
      setLoading(false);
      return;
    }
    loadTowns();
  }, [profile?.couple_id]);

  async function loadTowns() {
    const { data } = await supabase
      .from("towns")
      .select("*, ratings(*)")
      .eq("couple_id", profile!.couple_id!)
      .order("created_at", { ascending: false });
    setTowns((data as TownWithRatings[]) ?? []);
    setLoading(false);
  }

  async function markAsVisited(townId: string) {
    await supabase
      .from("towns")
      .update({
        visited: true,
        visited_at: new Date().toISOString().split("T")[0],
      })
      .eq("id", townId);
    loadTowns();
  }

  function getAverageScore(ratings: Rating[]): number | null {
    if (ratings.length === 0) return null;
    const keys = RATING_CATEGORIES.map((c) => c.key);
    let total = 0;
    let count = 0;
    for (const r of ratings) {
      for (const k of keys) {
        total += r[k as keyof Rating] as number;
        count++;
      }
    }
    return count > 0 ? total / count : null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-2xl">🏠</div>
      </div>
    );
  }

  if (!profile?.couple_id) {
    return (
      <div className="p-4 text-center">
        <div className="text-4xl mb-4">💑</div>
        <h2 className="text-lg font-semibold mb-2">はじめましょう！</h2>
        <p className="text-sm text-muted-foreground mb-4">
          二人でアプリを使うための設定をします
        </p>
        <Link
          href="/onboarding"
          className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
        >
          セットアップを始める
        </Link>
      </div>
    );
  }

  const visitedTowns = towns.filter((t) => t.visited);
  const wishlistTowns = towns.filter((t) => !t.visited);

  function DiagnosisBanner() {
    return (
      <Link href="/diagnosis">
        <div className="bg-gradient-to-r from-pink-100 to-pink-50 rounded-xl p-4 flex items-center gap-3 mb-4 active:scale-[0.98] transition-transform">
          <span className="text-3xl">🔮</span>
          <div className="flex-1">
            <p className="font-bold text-sm">住みたい町診断</p>
            <p className="text-xs text-muted-foreground">二人にぴったりの町を見つけよう</p>
          </div>
          <span className="text-primary font-bold text-sm">→</span>
        </div>
      </Link>
    );
  }

  function TownCard({ town }: { town: TownWithRatings }) {
    const avg = getAverageScore(town.ratings);
    return (
      <Link key={town.id} href={`/towns/${town.id}`}>
        <Card className="active:scale-[0.98] transition-transform">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">
                  {town.name}
                </h3>
                {town.station && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    🚃 {town.station}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {town.visited && town.visited_at
                    ? new Date(town.visited_at).toLocaleDateString("ja-JP")
                    : "未訪問"}
                </p>
              </div>
              <div className="text-right ml-3">
                {avg !== null ? (
                  <>
                    <div className="text-2xl font-bold text-primary">
                      {avg.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">/ 5.0</div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">未評価</div>
                )}
              </div>
            </div>
            {town.ratings.length > 0 && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-sm ${
                      avg !== null && star <= Math.round(avg)
                        ? "text-pink-400"
                        : "text-pink-100"
                    }`}
                  >
                    ★
                  </span>
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  ({town.ratings.length}人が評価)
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    );
  }

  function WishlistCard({ town }: { town: TownWithRatings }) {
    return (
      <Card className="active:scale-[0.98] transition-transform">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Link href={`/towns/${town.id}`} className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{town.name}</h3>
              {town.station && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  🚃 {town.station}
                </p>
              )}
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault();
                markAsVisited(town.id);
              }}
              className="ml-3 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium active:scale-95 transition-transform"
            >
              行った!
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <DiagnosisBanner />
      <Tabs defaultValue="visited">
        <TabsList className="w-full">
          <TabsTrigger value="visited" className="flex-1">
            ✅ 行った ({visitedTowns.length})
          </TabsTrigger>
          <TabsTrigger value="wishlist" className="flex-1">
            📌 行きたい ({wishlistTowns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visited" className="mt-4 space-y-3">
          {visitedTowns.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🗺️</div>
              <p className="text-muted-foreground mb-4">
                まだ町が登録されていません
              </p>
              <Link
                href="/towns/new"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
              >
                最初の町を登録する
              </Link>
            </div>
          ) : (
            visitedTowns.map((town) => (
              <TownCard key={town.id} town={town} />
            ))
          )}
        </TabsContent>

        <TabsContent value="wishlist" className="mt-4 space-y-3">
          {wishlistTowns.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📌</div>
              <p className="text-muted-foreground mb-4">
                行きたい町を追加しよう
              </p>
              <Link
                href="/towns/new"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
              >
                行きたい町を追加
              </Link>
            </div>
          ) : (
            wishlistTowns.map((town) => (
              <WishlistCard key={town.id} town={town} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      <Link
        href="/towns/new"
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-95 transition-transform"
      >
        +
      </Link>
    </div>
  );
}
