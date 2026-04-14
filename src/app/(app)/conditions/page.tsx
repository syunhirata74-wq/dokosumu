"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type {
  CoupleCondition,
  ConditionPriority,
  Profile,
} from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

const ICON_OPTIONS = [
  "🏠",
  "🚃",
  "🛒",
  "🌳",
  "🍽️",
  "💰",
  "🐶",
  "🎵",
  "🚗",
  "🏥",
  "👶",
  "🏋️",
  "📚",
  "🌙",
  "☀️",
  "🔒",
  "🛁",
  "📍",
];

export default function ConditionsPage() {
  const { user, profile } = useAuth();
  const [conditions, setConditions] = useState<CoupleCondition[]>([]);
  const [priorities, setPriorities] = useState<ConditionPriority[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("📋");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.couple_id) loadData();
  }, [profile?.couple_id]);

  async function loadData() {
    const coupleId = profile!.couple_id!;
    const [condRes, prioRes, memRes] = await Promise.all([
      supabase
        .from("couple_conditions")
        .select("*")
        .eq("couple_id", coupleId)
        .order("sort_order"),
      supabase.from("condition_priorities").select("*"),
      supabase.from("profiles").select("*").eq("couple_id", coupleId),
    ]);
    setConditions(condRes.data ?? []);
    setPriorities(prioRes.data ?? []);
    setMembers(memRes.data ?? []);
    setLoading(false);
  }

  async function addCondition() {
    if (!newLabel.trim() || !profile?.couple_id) return;
    setAdding(true);
    await supabase.from("couple_conditions").insert({
      couple_id: profile.couple_id,
      label: newLabel.trim(),
      icon: newIcon,
      sort_order: conditions.length,
    });
    setNewLabel("");
    setNewIcon("📋");
    setShowIconPicker(false);
    await loadData();
    setAdding(false);
  }

  async function removeCondition(id: string) {
    await supabase.from("couple_conditions").delete().eq("id", id);
    await loadData();
  }

  async function setWeight(conditionId: string, weight: number) {
    if (!user) return;
    const existing = priorities.find(
      (p) => p.condition_id === conditionId && p.user_id === user.id
    );
    if (existing) {
      await supabase
        .from("condition_priorities")
        .update({ weight })
        .eq("id", existing.id);
    } else {
      await supabase.from("condition_priorities").insert({
        condition_id: conditionId,
        user_id: user.id,
        weight,
      });
    }
    // Optimistic update
    setPriorities((prev) => {
      const filtered = prev.filter(
        (p) => !(p.condition_id === conditionId && p.user_id === user!.id)
      );
      return [
        ...filtered,
        {
          id: existing?.id ?? "temp",
          condition_id: conditionId,
          user_id: user!.id,
          weight,
          created_at: new Date().toISOString(),
        },
      ];
    });
  }

  function getMyWeight(conditionId: string): number {
    return (
      priorities.find(
        (p) => p.condition_id === conditionId && p.user_id === user?.id
      )?.weight ?? 3
    );
  }

  function getPartnerWeight(conditionId: string): number {
    return (
      priorities.find(
        (p) => p.condition_id === conditionId && p.user_id !== user?.id
      )?.weight ?? 3
    );
  }

  const me = members.find((m) => m.id === user?.id);
  const partner = members.find((m) => m.id !== user?.id);

  const chartData = conditions.map((c) => ({
    label: c.label,
    [me?.name ?? "自分"]: getMyWeight(c.id),
    [partner?.name ?? "相手"]: getPartnerWeight(c.id),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-2xl">📋</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">ふたりの条件</h1>
      <p className="text-sm text-muted-foreground">
        住む町に求める条件と、それぞれの優先度を設定しよう
      </p>

      {/* Radar Chart */}
      {conditions.length >= 3 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2 text-center">優先度の比較</h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={chartData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                <Radar
                  name={me?.name ?? "自分"}
                  dataKey={me?.name ?? "自分"}
                  stroke="#ec4899"
                  fill="#ec4899"
                  fillOpacity={0.2}
                />
                <Radar
                  name={partner?.name ?? "相手"}
                  dataKey={partner?.name ?? "相手"}
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.2}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Conditions list with sliders */}
      <div className="space-y-3">
        {conditions.map((cond) => (
          <Card key={cond.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cond.icon}</span>
                  <span className="font-medium text-sm">{cond.label}</span>
                </div>
                <button
                  onClick={() => removeCondition(cond.id)}
                  className="text-xs text-muted-foreground hover:text-destructive px-2"
                >
                  削除
                </button>
              </div>

              {/* My priority */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-500 font-medium">
                    {me?.name ?? "自分"}
                  </span>
                  <span className="font-bold text-emerald-500">
                    {getMyWeight(cond.id)}
                  </span>
                </div>
                <Slider
                  value={[getMyWeight(cond.id)]}
                  onValueChange={(vals) =>
                    setWeight(
                      cond.id,
                      Array.isArray(vals) ? vals[0] : vals
                    )
                  }
                  min={1}
                  max={5}
                  step={1}
                  className="py-1"
                />
              </div>

              {/* Partner priority (read-only) */}
              {partner && (
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-violet-500 font-medium">
                      {partner.name}
                    </span>
                    <span className="font-bold text-violet-500">
                      {getPartnerWeight(cond.id)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-400 rounded-full transition-all"
                      style={{
                        width: `${(getPartnerWeight(cond.id) / 5) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add condition */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">条件を追加</h3>

          <div className="flex gap-2">
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-12 h-12 border rounded-lg flex items-center justify-center text-xl"
            >
              {newIcon}
            </button>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="例: ペット可、駐車場、学校近い"
              className="h-12 text-base flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") addCondition();
              }}
            />
          </div>

          {showIconPicker && (
            <div className="grid grid-cols-9 gap-1.5">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => {
                    setNewIcon(icon);
                    setShowIconPicker(false);
                  }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${
                    newIcon === icon
                      ? "bg-primary/10 border border-primary"
                      : "border"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}

          <Button
            onClick={addCondition}
            disabled={adding || !newLabel.trim()}
            className="w-full h-12"
          >
            {adding ? "追加中..." : "この条件を追加"}
          </Button>
        </CardContent>
      </Card>

      {conditions.length < 3 && conditions.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          ※ レーダーチャートは3つ以上の条件で表示されます
        </p>
      )}
    </div>
  );
}
