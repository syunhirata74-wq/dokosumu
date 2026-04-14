"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = isSignUp
      ? await signUp(email, password, name)
      : await signIn(email, password);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.replace("/");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-pink-100 via-pink-50 to-white">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-1">🏠</div>
          <CardTitle className="text-xl">どこ住む？</CardTitle>
          <p className="text-sm text-muted-foreground">
            二人で理想の町を見つけよう
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* LINE Login - メインCTA */}
          <a
            href="/api/auth/line?mode=login"
            className="flex items-center justify-center gap-2 w-full h-14 bg-[#06C755] hover:bg-[#05b34d] text-white rounded-lg font-bold text-base transition-colors"
          >
            LINEでログイン
          </a>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">
              またはメールで
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs">名前</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="あなたの名前"
                  required={isSignUp}
                  className="h-11 text-sm"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="h-11 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                required
                minLength={6}
                className="h-11 text-sm"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              type="submit"
              variant="outline"
              className="w-full h-11 text-sm"
              disabled={submitting}
            >
              {submitting
                ? "..."
                : isSignUp
                  ? "アカウント作成"
                  : "メールでログイン"}
            </Button>
          </form>
          <div className="text-center">
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
            >
              {isSignUp
                ? "既にアカウントをお持ちの方"
                : "新規アカウント作成"}
            </button>
          </div>
        </CardContent>
      </Card>
      <div className="text-center text-[10px] text-muted-foreground mt-4 space-x-2">
        <a href="/terms" className="underline">利用規約</a>
        <span>|</span>
        <a href="/privacy" className="underline">プライバシーポリシー</a>
      </div>
    </div>
  );
}
