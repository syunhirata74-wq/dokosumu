export type Database = {
  public: {
    Tables: {
      couples: {
        Row: {
          id: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invite_code?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          invite_code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          couple_id: string | null;
          name: string;
          avatar_url: string | null;
          workplace_station: string | null;
          workplace_station_code: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          couple_id?: string | null;
          name: string;
          avatar_url?: string | null;
          workplace_station?: string | null;
          workplace_station_code?: string | null;
          created_at?: string;
        };
        Update: {
          couple_id?: string | null;
          name?: string;
          avatar_url?: string | null;
          workplace_station?: string | null;
          workplace_station_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      towns: {
        Row: {
          id: string;
          couple_id: string;
          name: string;
          station: string | null;
          station_code: string | null;
          visited_at: string | null;
          visited: boolean;
          lat: number;
          lng: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          name: string;
          station?: string | null;
          station_code?: string | null;
          visited_at?: string | null;
          visited?: boolean;
          lat: number;
          lng: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          station?: string | null;
          station_code?: string | null;
          visited_at?: string | null;
          visited?: boolean;
          lat?: number;
          lng?: number;
        };
        Relationships: [
          {
            foreignKeyName: "towns_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      spots: {
        Row: {
          id: string;
          town_id: string;
          name: string;
          category: string;
          memo: string | null;
          photo_url: string | null;
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          town_id: string;
          name: string;
          category: string;
          memo?: string | null;
          photo_url?: string | null;
          lat?: number | null;
          lng?: number | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          category?: string;
          memo?: string | null;
          photo_url?: string | null;
          lat?: number | null;
          lng?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "spots_town_id_fkey";
            columns: ["town_id"];
            isOneToOne: false;
            referencedRelation: "towns";
            referencedColumns: ["id"];
          },
        ];
      };
      ratings: {
        Row: {
          id: string;
          town_id: string;
          user_id: string;
          living_env: number;
          transport: number;
          shopping: number;
          nature: number;
          dining: number;
          rent: number;
          overall: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          town_id: string;
          user_id: string;
          living_env: number;
          transport: number;
          shopping: number;
          nature: number;
          dining: number;
          rent: number;
          overall: number;
          created_at?: string;
        };
        Update: {
          living_env?: number;
          transport?: number;
          shopping?: number;
          nature?: number;
          dining?: number;
          rent?: number;
          overall?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_town_id_fkey";
            columns: ["town_id"];
            isOneToOne: false;
            referencedRelation: "towns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      town_comments: {
        Row: {
          id: string;
          town_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          town_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [
          {
            foreignKeyName: "town_comments_town_id_fkey";
            columns: ["town_id"];
            isOneToOne: false;
            referencedRelation: "towns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "town_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      spot_favorites: {
        Row: {
          id: string;
          spot_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          spot_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {};
        Relationships: [
          {
            foreignKeyName: "spot_favorites_spot_id_fkey";
            columns: ["spot_id"];
            isOneToOne: false;
            referencedRelation: "spots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "spot_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      town_rents: {
        Row: {
          id: string;
          town_id: string;
          rent_avg: number | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          town_id: string;
          rent_avg?: number | null;
          fetched_at?: string;
        };
        Update: {
          rent_avg?: number | null;
          fetched_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "town_rents_town_id_fkey";
            columns: ["town_id"];
            isOneToOne: true;
            referencedRelation: "towns";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_conditions: {
        Row: {
          id: string;
          couple_id: string;
          label: string;
          icon: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          label: string;
          icon?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          label?: string;
          icon?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "couple_conditions_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      condition_priorities: {
        Row: {
          id: string;
          condition_id: string;
          user_id: string;
          weight: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          condition_id: string;
          user_id: string;
          weight?: number;
          created_at?: string;
        };
        Update: {
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "condition_priorities_condition_id_fkey";
            columns: ["condition_id"];
            isOneToOne: false;
            referencedRelation: "couple_conditions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "condition_priorities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      town_recommendations: {
        Row: {
          id: string;
          town_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          town_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {};
        Relationships: [
          {
            foreignKeyName: "town_recommendations_town_id_fkey";
            columns: ["town_id"];
            isOneToOne: false;
            referencedRelation: "towns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "town_recommendations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      town_likes: {
        Row: {
          couple_id: string;
          station_code: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          couple_id: string;
          station_code: string;
          user_id: string;
          created_at?: string;
        };
        Update: {};
        Relationships: [];
      };
      town_swipes: {
        Row: {
          couple_id: string;
          station_code: string;
          user_id: string;
          direction: "left" | "right";
          created_at: string;
        };
        Insert: {
          couple_id: string;
          station_code: string;
          user_id: string;
          direction: "left" | "right";
          created_at?: string;
        };
        Update: {
          direction?: "left" | "right";
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
};

export type Couple = Database["public"]["Tables"]["couples"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Town = Database["public"]["Tables"]["towns"]["Row"];
export type Spot = Database["public"]["Tables"]["spots"]["Row"];
export type Rating = Database["public"]["Tables"]["ratings"]["Row"];
export type TownComment = Database["public"]["Tables"]["town_comments"]["Row"];
export type SpotFavorite = Database["public"]["Tables"]["spot_favorites"]["Row"];
export type TownRent = Database["public"]["Tables"]["town_rents"]["Row"];
export type CoupleCondition = Database["public"]["Tables"]["couple_conditions"]["Row"];
export type ConditionPriority = Database["public"]["Tables"]["condition_priorities"]["Row"];
export type TownRecommendation = Database["public"]["Tables"]["town_recommendations"]["Row"];
export type TownLike = Database["public"]["Tables"]["town_likes"]["Row"];
export type TownSwipe = Database["public"]["Tables"]["town_swipes"]["Row"];

export const FACILITY_TYPES = [
  { value: "supermarket", label: "スーパー", icon: "🛒", googleType: "supermarket" },
  { value: "convenience_store", label: "コンビニ", icon: "🏪", googleType: "convenience_store" },
  { value: "hospital", label: "病院", icon: "🏥", googleType: "hospital" },
  { value: "pharmacy", label: "薬局", icon: "💊", googleType: "pharmacy" },
  { value: "park", label: "公園", icon: "🌳", googleType: "park" },
  { value: "gym", label: "ジム", icon: "🏋️", googleType: "gym" },
  { value: "restaurant", label: "飲食店", icon: "🍽️", googleType: "restaurant" },
  { value: "cafe", label: "カフェ", icon: "☕", googleType: "cafe" },
  { value: "day_care", label: "保育園", icon: "🧒", googleType: "day_care" },
  { value: "primary_school", label: "小学校", icon: "🏫", googleType: "primary_school" },
  { value: "secondary_school", label: "中学・高校", icon: "🎒", googleType: "secondary_school" },
  { value: "library", label: "図書館", icon: "📚", googleType: "library" },
] as const;

export const RATING_CATEGORIES = [
  { key: "living_env", label: "住環境", icon: "🏠" },
  { key: "transport", label: "交通アクセス", icon: "🚃" },
  { key: "shopping", label: "買い物", icon: "🛒" },
  { key: "nature", label: "自然・公園", icon: "🌳" },
  { key: "dining", label: "飲食店", icon: "🍽️" },
  { key: "rent", label: "家賃相場", icon: "💰" },
  { key: "overall", label: "総合", icon: "❤️" },
] as const;

export type RatingKey = (typeof RATING_CATEGORIES)[number]["key"];

export const SPOT_CATEGORIES = [
  { value: "supermarket", label: "スーパー", icon: "🛒" },
  { value: "convenience_store", label: "コンビニ", icon: "🏪" },
  { value: "hospital", label: "病院", icon: "🏥" },
  { value: "pharmacy", label: "薬局", icon: "💊" },
  { value: "park", label: "公園", icon: "🌳" },
  { value: "gym", label: "ジム", icon: "🏋️" },
  { value: "restaurant", label: "飲食店", icon: "🍽️" },
  { value: "cafe", label: "カフェ", icon: "☕" },
  { value: "day_care", label: "保育園", icon: "🧒" },
  { value: "primary_school", label: "小学校", icon: "🏫" },
  { value: "secondary_school", label: "中学・高校", icon: "🎒" },
  { value: "library", label: "図書館", icon: "📚" },
  { value: "vibe", label: "雰囲気", icon: "✨" },
  { value: "other", label: "その他", icon: "📍" },
] as const;
