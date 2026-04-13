"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Profile } from "@/types/database";

type Station = { c: string; n: string; p: string };
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function Avatar({
  profile,
  size = "md",
}: {
  profile: Profile | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "w-16 h-16 text-2xl"
      : size === "md"
        ? "w-12 h-12 text-xl"
        : "w-8 h-8 text-sm";

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.name}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} bg-primary/10 rounded-full flex items-center justify-center`}
    >
      {profile?.name?.charAt(0) ?? "?"}
    </div>
  );
}

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const [partner, setPartner] = useState<Profile | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [myInviteCode, setMyInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [workplaceQuery, setWorkplaceQuery] = useState("");
  const [showStationList, setShowStationList] = useState(false);
  const [savingWorkplace, setSavingWorkplace] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/stations.json")
      .then((r) => r.json())
      .then(setStations);
  }, []);

  useEffect(() => {
    if (profile?.workplace_station) {
      setWorkplaceQuery(profile.workplace_station);
    }
  }, [profile?.workplace_station]);

  const filteredStations = useMemo(() => {
    if (!workplaceQuery.trim()) return [];
    const q = workplaceQuery.trim().toLowerCase();
    return stations.filter((s) => s.n.toLowerCase().includes(q)).slice(0, 10);
  }, [workplaceQuery, stations]);

  useEffect(() => {
    const lineResult = searchParams.get("line");
    const lineReason = searchParams.get("reason");
    if (lineResult === "success") {
      setMessage("LINE連携が完了しました！");
      window.location.reload();
    } else if (lineResult === "error") {
      const reasons: Record<string, string> = {
        token: "LINEの認証に失敗しました。もう一度お試しください",
        profile: "LINEプロフィールの取得に失敗しました",
        auth: "ログインセッションが切れています。再ログインしてからお試しください",
      };
      setMessage(reasons[lineReason ?? ""] ?? "LINE連携に失敗しました。もう一度お試しください");
    }
  }, [searchParams]);

  useEffect(() => {
    if (profile?.couple_id) {
      loadCoupleData();
    }
  }, [profile?.couple_id]);

  async function loadCoupleData() {
    const coupleId = profile?.couple_id;
    if (!coupleId) return;

    const [coupleRes, membersRes] = await Promise.all([
      supabase
        .from("couples")
        .select("*")
        .eq("id", coupleId as string)
        .single(),
      supabase
        .from("profiles")
        .select("*")
        .eq("couple_id", coupleId as string),
    ]);

    if (coupleRes.data) setMyInviteCode(coupleRes.data.invite_code);

    const partnerProfile = membersRes.data?.find((m) => m.id !== user?.id);
    setPartner(partnerProfile ?? null);
  }

  async function connectLine() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      window.location.href = `/api/auth/line?token=${session.access_token}`;
    }
  }

  async function createCouple() {
    if (!user) return;
    setCreating(true);
    setMessage("");

    const { data, error } = await supabase
      .from("couples")
      .insert({})
      .select()
      .single();

    if (error) {
      setMessage("作成に失敗しました");
      setCreating(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ couple_id: data.id })
      .eq("id", user.id);

    setMyInviteCode(data.invite_code);
    setMessage("カップルを作成しました！");
    setCreating(false);
    window.location.reload();
  }

  async function joinCouple() {
    if (!user || !inviteCode.trim()) return;
    setJoining(true);
    setMessage("");

    const { data, error } = await supabase
      .from("couples")
      .select("id")
      .eq("invite_code", inviteCode.trim())
      .single();

    if (error || !data) {
      setMessage("招待コードが見つかりません");
      setJoining(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ couple_id: data.id })
      .eq("id", user.id);

    setMessage("カップルに参加しました！");
    setJoining(false);
    window.location.reload();
  }

  async function shareInviteCode() {
    if (navigator.share) {
      await navigator.share({
        title: "どこ住む？",
        text: `招待コード: ${myInviteCode}\nアプリに参加してね！`,
      });
    } else {
      await navigator.clipboard.writeText(myInviteCode);
      setMessage("コードをコピーしました！");
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">設定</h1>

      {/* Two profiles side by side */}
      {profile?.couple_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ふたりのプロフィール</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Me */}
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <Avatar profile={profile} size="lg" />
                </div>
                <div>
                  <p className="font-medium text-sm">{profile?.name}</p>
                  {profile?.avatar_url ? (
                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                      LINE連携済み
                    </span>
                  ) : (
                    <button
                      onClick={connectLine}
                      className="text-[10px] text-white bg-[#06C755] px-1.5 py-0.5 rounded-full"
                    >
                      LINE連携する
                    </button>
                  )}
                </div>
              </div>

              {/* Partner */}
              <div className="text-center space-y-2">
                {partner ? (
                  <>
                    <div className="flex justify-center">
                      <Avatar profile={partner} size="lg" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{partner.name}</p>
                      {partner.avatar_url ? (
                        <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                          LINE連携済み
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          LINE未連携
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-2xl border-2 border-dashed border-muted-foreground/30">
                        ?
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      相手の参加を待っています
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* LINE connect button if not connected */}
            {!profile?.avatar_url && (
              <Button
                variant="outline"
                className="w-full h-12 mt-4 bg-[#06C755] hover:bg-[#05b34d] text-white border-0 font-medium"
                onClick={connectLine}
              >
                LINE と連携する
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* My profile (when no couple) */}
      {!profile?.couple_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">プロフィール</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar profile={profile} />
              <div>
                <p className="font-medium">{profile?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Couple settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">カップル設定</CardTitle>
          <CardDescription>
            二人でデータを共有するための設定です
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.couple_id ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  招待コード
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-lg font-mono tracking-wider">
                    {myInviteCode}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareInviteCode}
                  >
                    共有
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {partner
                  ? `${partner.name} と接続中`
                  : "このコードを相手に送って参加してもらいましょう"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                onClick={createCouple}
                disabled={creating}
                className="w-full h-12"
              >
                {creating ? "作成中..." : "新しいカップルを作成"}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">または</span>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite">招待コードで参加</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="コードを入力"
                    className="h-12 text-base font-mono"
                  />
                  <Button
                    onClick={joinCouple}
                    disabled={joining || !inviteCode.trim()}
                    className="h-12 px-6"
                  >
                    {joining ? "..." : "参加"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {message && (
            <p className="text-sm text-center text-primary">{message}</p>
          )}
        </CardContent>
      </Card>

      {/* Workplace station */}
      {profile?.couple_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🚃 通勤先</CardTitle>
            <CardDescription>
              職場の最寄り駅を設定すると、町ごとの通勤時間がわかります
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Label className="text-xs text-muted-foreground">
                あなたの職場最寄り駅
              </Label>
              <Input
                value={workplaceQuery}
                onChange={(e) => {
                  setWorkplaceQuery(e.target.value);
                  setShowStationList(true);
                }}
                onFocus={() => setShowStationList(true)}
                placeholder="駅名を入力..."
                className="h-12 text-base mt-1"
              />
              {showStationList && filteredStations.length > 0 && (
                <div className="mt-2 space-y-2">
                  {filteredStations.map((s) => (
                    <button
                      key={s.c}
                      type="button"
                      onClick={async () => {
                        setWorkplaceQuery(s.n + "駅");
                        setShowStationList(false);
                        setSavingWorkplace(true);
                        await supabase
                          .from("profiles")
                          .update({
                            workplace_station: s.n + "駅",
                            workplace_station_code: s.c,
                          })
                          .eq("id", user!.id);
                        setSavingWorkplace(false);
                        setMessage(`✅ 通勤先を「${s.n}駅」に設定しました`);
                        setTimeout(() => window.location.reload(), 1000);
                      }}
                      className="w-full text-left px-4 py-4 bg-muted rounded-lg text-base flex justify-between items-center active:scale-[0.98] transition-transform"
                    >
                      <span className="font-medium text-base">🚃 {s.n}駅</span>
                      <span className="text-sm text-muted-foreground">{s.p}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {profile?.workplace_station && (
              <p className="text-xs text-primary">
                ✅ {profile.workplace_station} に設定済み
              </p>
            )}
            {partner?.workplace_station && (
              <p className="text-xs text-muted-foreground">
                {partner.name}: {partner.workplace_station}
              </p>
            )}
            {savingWorkplace && (
              <p className="text-xs text-muted-foreground">保存中...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* LINE Bot */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#06C755] rounded-full flex items-center justify-center text-white text-lg">
            💬
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">LINE Bot</p>
            <p className="text-xs text-muted-foreground">
              LINEからもランキングや行きたい町を確認できます
            </p>
          </div>
          <a
            href={`https://line.me/R/ti/p/@${process.env.NEXT_PUBLIC_LINE_BOT_ID ?? ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-[#06C755] text-white text-xs rounded-lg font-medium"
          >
            友だち追加
          </a>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full h-12 text-destructive"
        onClick={signOut}
      >
        ログアウト
      </Button>
    </div>
  );
}
