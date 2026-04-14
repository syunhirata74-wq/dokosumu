"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, BarChart3, Settings, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export default function ProfilePage() {
  const { user, profile } = useAuth();

  return (
    <div className="p-4 space-y-4 pb-20">
      <h1 className="text-lg font-bold">プロフィール</h1>

      {/* Avatar + Name */}
      <div className="text-center py-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-3" />
        ) : (
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">
            {profile?.name?.charAt(0) ?? "?"}
          </div>
        )}
        <h2 className="text-xl font-bold">{profile?.name}</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Menu */}
      <div className="space-y-2">
        <MenuLink href="/ranking" icon={<Trophy size={20} />} label="ランキング" desc="町の評価ランキング" />
        <MenuLink href="/conditions" icon={<Users size={20} />} label="ふたりの条件" desc="優先度の設定・比較" />
        <MenuLink href="/diagnosis/values" icon={<BarChart3 size={20} />} label="価値観マップ" desc="二人のズレを可視化" />
        <MenuLink href="/settings" icon={<Settings size={20} />} label="設定" desc="カップル・通勤先・LINE連携" />
      </div>

      {/* Legal */}
      <div className="flex justify-center gap-4 text-[10px] text-muted-foreground pt-4">
        <a href="/terms" className="underline">利用規約</a>
        <a href="/privacy" className="underline">プライバシーポリシー</a>
      </div>
    </div>
  );
}

function MenuLink({ href, icon, label, desc }: { href: string; icon: ReactNode; label: string; desc: string }) {
  return (
    <Link href={href}>
      <Card className="active:scale-[0.98] transition-transform">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="text-primary">{icon}</div>
          <div className="flex-1">
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
