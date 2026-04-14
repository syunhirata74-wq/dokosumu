"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Town, Rating, TownComment, Spot, Profile } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Compass, Heart, Check, Star, MessageCircle, Footprints } from "lucide-react";
import { toast } from "sonner";

type TownWithData = Town & {
  ratings: Rating[];
  town_comments: TownComment[];
  spots: Spot[];
};

function MiniAvatar({ profile, size = 20 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt={profile.name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold" style={{ width: size, height: size }}>
      {profile.name?.charAt(0)}
    </div>
  );
}

function getRatingStatus(town: TownWithData, me: Profile | undefined, partner: Profile | undefined) {
  const myRated = me ? town.ratings.some((r) => r.user_id === me.id) : false;
  const partnerRated = partner ? town.ratings.some((r) => r.user_id === partner.id) : false;
  const myCommented = me ? town.town_comments.some((c) => c.user_id === me.id) : false;
  const partnerCommented = partner ? town.town_comments.some((c) => c.user_id === partner.id) : false;
  return { myRated, partnerRated, myCommented, partnerCommented };
}

export default function MatchesPage() {
  const { user, profile } = useAuth();
  const [towns, setTowns] = useState<TownWithData[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.couple_id) { setLoading(false); return; }
    loadData();
  }, [profile?.couple_id]);

  async function loadData() {
    const [townsRes, membersRes] = await Promise.all([
      supabase
        .from("towns")
        .select("*, ratings(*), town_comments(*), spots(*)")
        .eq("couple_id", profile!.couple_id!)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("*")
        .eq("couple_id", profile!.couple_id!),
    ]);
    setTowns((townsRes.data as TownWithData[]) ?? []);
    setMembers(membersRes.data ?? []);
    setLoading(false);
  }

  async function markVisited(townId: string) {
    await supabase.from("towns").update({
      visited: true,
      visited_at: new Date().toISOString().split("T")[0],
    }).eq("id", townId);
    toast.success("散歩完了！次は二人で評価してみよう");
    loadData();
  }

  const me = members.find((m) => m.id === user?.id);
  const partner = members.find((m) => m.id !== user?.id);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse"><Heart size={24} className="text-primary" /></div></div>;
  }

  const wishlistTowns = towns.filter((t) => !t.visited);
  const visitedTowns = towns.filter((t) => t.visited);

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">候補</h1>
        <Link href="/towns/new" className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-90 transition-transform">
          <Plus size={20} />
        </Link>
      </div>

      {/* Couple header */}
      {partner && (
        <div className="flex items-center justify-center gap-3 py-2">
          {me && <MiniAvatar profile={me} size={28} />}
          <span className="text-xs text-muted-foreground">×</span>
          <MiniAvatar profile={partner} size={28} />
          <span className="text-xs text-muted-foreground ml-1">
            {partner.name}と一緒に探し中
          </span>
        </div>
      )}

      <Tabs defaultValue="wishlist">
        <TabsList className="w-full">
          <TabsTrigger value="wishlist" className="flex-1">行きたい ({wishlistTowns.length})</TabsTrigger>
          <TabsTrigger value="visited" className="flex-1">行った ({visitedTowns.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="wishlist" className="mt-4 space-y-3">
          {wishlistTowns.length === 0 ? (
            <div className="text-center py-12">
              <Compass size={40} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-sm mb-4">まだ候補がありません</p>
              <Link href="/" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium text-sm">
                町を発見しに行く
              </Link>
            </div>
          ) : (
            wishlistTowns.map((town) => (
              <Card key={town.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <Link href={`/towns/${town.id}`}>
                    <div className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-base">{town.name}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin size={12} /> {town.station}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          次: 散歩に行こう
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="px-4 pb-3">
                    <Button size="sm" className="w-full h-10" onClick={(e) => { e.preventDefault(); markVisited(town.id); }}>
                      <Footprints size={16} className="mr-1" /> 二人で散歩してきた！
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="visited" className="mt-4 space-y-3">
          {visitedTowns.length === 0 ? (
            <div className="text-center py-12">
              <MapPin size={40} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">まだ訪問した町がありません</p>
            </div>
          ) : (
            visitedTowns.map((town) => {
              const status = getRatingStatus(town, me, partner);
              const bothRated = status.myRated && status.partnerRated;
              const neitherRated = !status.myRated && !status.partnerRated;

              return (
                <Card key={town.id} className={`overflow-hidden ${bothRated ? "border-primary" : ""}`}>
                  <CardContent className="p-0">
                    <Link href={`/towns/${town.id}`}>
                      <div className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-base">{town.name}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin size={12} /> {town.station}
                            </p>
                          </div>
                          {bothRated && (
                            <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                              <Check size={10} /> 二人とも評価済み
                            </div>
                          )}
                        </div>

                        {/* Two-person rating status */}
                        <div className="flex gap-2 mt-3">
                          {me && (
                            <div className={`flex-1 flex items-center gap-2 p-2 rounded-lg text-xs ${status.myRated ? "bg-primary/5" : "bg-muted"}`}>
                              <MiniAvatar profile={me} size={20} />
                              <div>
                                <div className="font-medium">{me.name}</div>
                                <div className="text-muted-foreground text-[10px]">
                                  {status.myRated ? (
                                    <span className="text-primary flex items-center gap-0.5"><Star size={8} fill="currentColor" /> 評価済み</span>
                                  ) : "未評価"}
                                </div>
                              </div>
                            </div>
                          )}
                          {partner && (
                            <div className={`flex-1 flex items-center gap-2 p-2 rounded-lg text-xs ${status.partnerRated ? "bg-primary/5" : "bg-muted"}`}>
                              <MiniAvatar profile={partner} size={20} />
                              <div>
                                <div className="font-medium">{partner.name}</div>
                                <div className="text-muted-foreground text-[10px]">
                                  {status.partnerRated ? (
                                    <span className="text-primary flex items-center gap-0.5"><Star size={8} fill="currentColor" /> 評価済み</span>
                                  ) : "未評価"}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Next action */}
                    {!status.myRated && (
                      <div className="px-4 pb-3">
                        <Link href={`/towns/${town.id}/rate`}>
                          <Button size="sm" variant="outline" className="w-full h-10">
                            <Star size={14} className="mr-1" /> 評価する
                          </Button>
                        </Link>
                      </div>
                    )}
                    {status.myRated && !status.myCommented && (
                      <div className="px-4 pb-3">
                        <Link href={`/towns/${town.id}`}>
                          <Button size="sm" variant="outline" className="w-full h-10">
                            <MessageCircle size={14} className="mr-1" /> 感想を書く
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
