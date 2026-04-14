"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Town, Rating } from "@/types/database";
import { RATING_CATEGORIES } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Star, MapPin, Heart, Compass } from "lucide-react";

type TownWithRatings = Town & { ratings: Rating[] };

export default function MatchesPage() {
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
        <div className="animate-pulse"><Heart size={24} className="text-primary" /></div>
      </div>
    );
  }

  const visitedTowns = towns.filter((t) => t.visited);
  const wishlistTowns = towns.filter((t) => !t.visited);

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">候補</h1>
        <Link href="/towns/new" className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-90 transition-transform">
          <Plus size={20} />
        </Link>
      </div>

      <Tabs defaultValue="wishlist">
        <TabsList className="w-full">
          <TabsTrigger value="wishlist" className="flex-1">
            行きたい ({wishlistTowns.length})
          </TabsTrigger>
          <TabsTrigger value="visited" className="flex-1">
            行った ({visitedTowns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wishlist" className="mt-4 space-y-3">
          {wishlistTowns.length === 0 ? (
            <div className="text-center py-12">
              <Compass size={40} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-sm mb-4">
                まだマッチがありません
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium text-sm"
              >
                町を発見しに行く
              </Link>
            </div>
          ) : (
            wishlistTowns.map((town) => (
              <TownMatchCard key={town.id} town={town} />
            ))
          )}
        </TabsContent>

        <TabsContent value="visited" className="mt-4 space-y-3">
          {visitedTowns.length === 0 ? (
            <div className="text-center py-12">
              <MapPin size={40} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                まだ訪問した町がありません
              </p>
            </div>
          ) : (
            visitedTowns.map((town) => {
              const avg = getAverageScore(town.ratings);
              return (
                <Link key={town.id} href={`/towns/${town.id}`}>
                  <Card className="active:scale-[0.98] transition-transform">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold">{town.name}</h3>
                          <p className="text-xs text-muted-foreground">{town.station}</p>
                        </div>
                        {avg !== null && (
                          <div className="text-right">
                            <div className="text-xl font-bold text-primary">{avg.toFixed(1)}</div>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <span key={s} className={`text-xs ${s <= Math.round(avg) ? "text-emerald-400" : "text-emerald-100"}`}>★</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TownMatchCard({ town }: { town: Town }) {
  return (
    <Link href={`/towns/${town.id}`}>
      <Card className="active:scale-[0.98] transition-transform overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-100 to-emerald-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">{town.name}</h3>
              <p className="text-xs text-muted-foreground">{town.station}</p>
            </div>
            <Heart size={20} className="text-primary" fill="currentColor" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
