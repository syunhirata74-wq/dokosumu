"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Users, PartyPopper, Home } from "lucide-react";

export default function OnboardingPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(profile?.couple_id ? 2 : 0);
  const [inviteCode, setInviteCode] = useState("");
  const [myCode, setMyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createCouple() {
    if (!user) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("couples")
      .insert({})
      .select()
      .single();
    if (err) {
      setError("作成に失敗しました");
      setLoading(false);
      return;
    }
    await supabase
      .from("profiles")
      .update({ couple_id: data.id })
      .eq("id", user.id);
    setMyCode(data.invite_code);
    setLoading(false);
    setStep(1);
  }

  async function joinCouple() {
    if (!user || !inviteCode.trim()) return;
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("couples")
      .select("id")
      .eq("invite_code", inviteCode.trim())
      .single();
    if (err || !data) {
      setError("招待コードが見つかりません");
      setLoading(false);
      return;
    }
    await supabase
      .from("profiles")
      .update({ couple_id: data.id })
      .eq("id", user.id);
    setLoading(false);
    setStep(2);
  }

  async function shareCode() {
    if (navigator.share) {
      await navigator.share({
        title: "どこ住む？",
        text: `一緒に住む町を探そう！\n招待コード: ${myCode}\nhttps://dokosumu.vercel.app`,
      });
    } else {
      await navigator.clipboard.writeText(myCode);
    }
  }

  const steps = [
    // Step 0: Create or Join
    <Card key="0">
      <CardContent className="p-6 space-y-6 text-center">
        <div><Users size={48} className="mx-auto text-primary" /></div>
        <h2 className="text-xl font-bold">二人で始めよう</h2>
        <p className="text-sm text-muted-foreground">
          カップルでアプリを使うための設定をします
        </p>

        <Button onClick={createCouple} disabled={loading} className="w-full h-14 text-base">
          {loading ? "作成中..." : "カップルを作成する"}
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">または</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">招待コードで参加</p>
          <div className="flex gap-2">
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="コードを入力"
              className="h-12 text-base font-mono"
            />
            <Button
              onClick={joinCouple}
              disabled={loading || !inviteCode.trim()}
              className="h-12 px-6"
            >
              参加
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>,

    // Step 1: Share invite code
    <Card key="1">
      <CardContent className="p-6 space-y-6 text-center">
        <div><PartyPopper size={48} className="mx-auto text-primary" /></div>
        <h2 className="text-xl font-bold">カップルを作成しました！</h2>
        <p className="text-sm text-muted-foreground">
          この招待コードを相手に送ってね
        </p>
        <div className="bg-muted p-4 rounded-xl">
          <code className="text-3xl font-mono font-bold tracking-wider">
            {myCode}
          </code>
        </div>
        <Button onClick={shareCode} variant="outline" className="w-full h-12">
          コードを共有する
        </Button>
        <Button onClick={() => setStep(2)} className="w-full h-12 text-base">
          次へ
        </Button>
      </CardContent>
    </Card>,

    // Step 2: Ready to go
    <Card key="2">
      <CardContent className="p-6 space-y-6 text-center">
        <div><Home size={48} className="mx-auto text-primary" /></div>
        <h2 className="text-xl font-bold">準備完了！</h2>
        <p className="text-sm text-muted-foreground">
          さっそく気になる町を登録してみよう
        </p>
        <Button
          onClick={() => router.push("/towns/new")}
          className="w-full h-14 text-base"
        >
          最初の町を登録する
        </Button>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-muted-foreground underline"
        >
          あとで登録する
        </button>
      </CardContent>
    </Card>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-100 via-emerald-50 to-white">
      <div className="w-full max-w-sm space-y-4">
        {/* Progress */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        {steps[step]}
      </div>
    </div>
  );
}
