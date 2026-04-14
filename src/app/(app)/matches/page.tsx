"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Town, Rating, TownComment, Spot } from "@/types/database";
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

type Step = {
  label: string;
  done: boolean;
  icon: React.ReactNode;
};

function getTownSteps(town: TownWithData, userId: string | undefined): { steps: Step[]; nextAction: { label: string; href: string } | null; progress: number } {
  const hasVisited = town.visited;
  const hasRated = town.ratings.some((r) => r.user_id === userId);
  const hasComment = town.town_comments.some((c) => c.user_id === userId);

  const steps: Step[] = [
    { label: "候補に追加", done: true, icon: <Heart size={14} /> },
    { label: "散歩に行く", done: hasVisited, icon: <Footprints size={14} /> },
    { label: "評価する", done: hasRated, icon: <Star size={14} /> },
    { label: "感想を書く", done: hasComment, icon: <MessageCircle size={14} /> },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = (doneCount / steps.length) * 100;

  let nextAction: { label: string; href: string } | null = null;
  if (!hasVisited) {
    nextAction = { label: "行った！をタップ", href: `/towns/${town.id}` };
  } else if (!hasRated) {
    nextAction = { label: "評価する", href: `/towns/${town.id}/rate` };
  } else if (!hasComment) {
    nextAction = { label: "感想を書く", href: `/towns/${town.id}` };
  }

  return { steps, nextAction, progress };
}

export default function MatchesPage() {
  const { user, profile } = useAuth();
  const [towns, setTowns] = useState<TownWithData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.couple_id) { setLoading(false); return; }
    loadTowns();
  }, [profile?.couple_id]);

  async function loadTowns() {
    const { data } = await supabase
      .from("towns")
      .select("*, ratings(*), town_comments(*), spots(*)")
      .eq("couple_id", profile!.couple_id!)
      .order("created_at", { ascending: false });
    setTowns((data as TownWithData[]) ?? []);
    setLoading(false);
  }

  async function markVisited(townId: string) {
    await supabase.from("towns").update({
      visited: true,
      visited_at: new Date().toISOString().split("T")[0],
    }).eq("id", townId);
    toast.success("散歩完了！次は評価してみよう");
    loadTowns();
  }

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
              <p className="text-muted-foreground text-sm mb-4">まだ候補がありません</p>
              <Link href="/" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium text-sm">
                町を発見しに行く
              </Link>
            </div>
          ) : (
            wishlistTowns.map((town) => {
              const { steps, progress } = getTownSteps(town, user?.id);
              return (
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
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">{Math.round(progress)}%</div>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        {/* Steps */}
                        <div className="flex gap-1 mt-2">
                          {steps.map((step, i) => (
                            <div key={i} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${step.done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {step.done ? <Check size={10} /> : step.icon}
                              <span>{step.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Link>
                    {/* Next action */}
                    <div className="px-4 pb-3 pt-1">
                      <Button
                        size="sm"
                        className="w-full h-10"
                        onClick={(e) => {
                          e.preventDefault();
                          markVisited(town.id);
                        }}
                      >
                        <Footprints size={16} className="mr-1" />
                        散歩に行った！
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
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
              const { steps, nextAction, progress } = getTownSteps(town, user?.id);
              const isComplete = progress === 100;
              return (
                <Card key={town.id} className={`overflow-hidden ${isComplete ? "border-primary" : ""}`}>
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
                          {isComplete ? (
                            <div className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                              <Check size={12} /> 完了
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">{Math.round(progress)}%</div>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div className="h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        {/* Steps */}
                        <div className="flex gap-1 mt-2">
                          {steps.map((step, i) => (
                            <div key={i} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${step.done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {step.done ? <Check size={10} /> : step.icon}
                              <span>{step.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Link>
                    {/* Next action */}
                    {nextAction && (
                      <div className="px-4 pb-3 pt-1">
                        <Link href={nextAction.href}>
                          <Button size="sm" variant="outline" className="w-full h-10">
                            {nextAction.label}
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
