// Hand-rolled types matching the SQL in supabase/migrations.
// Replace with auto-generated types from `supabase gen types typescript` once the
// remote project is linked, but this stays in sync for the MVP.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          daily_water_goal_ml: number;
          daily_steps_goal: number;
          daily_activity_hours_goal: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          daily_water_goal_ml?: number;
          daily_steps_goal?: number;
          daily_activity_hours_goal?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          daily_water_goal_ml?: number;
          daily_steps_goal?: number;
          daily_activity_hours_goal?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      snack_checks: {
        Row: {
          user_id: string;
          local_date: string;
          slot: number;
          done_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          local_date: string;
          slot: number;
          done_at?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          slot?: number;
          done_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_activity_logs: {
        Row: {
          user_id: string;
          local_date: string;
          steps: number | null;
          activity_hours: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          local_date: string;
          steps?: number | null;
          activity_hours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          steps?: number | null;
          activity_hours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      water_logs: {
        Row: {
          id: string;
          user_id: string;
          amount_ml: number;
          logged_at: string;
          local_date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_ml: number;
          logged_at?: string;
          local_date: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount_ml?: number;
          logged_at?: string;
          local_date?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          label: string;
          kind:
            | "tri_state"
            | "water"
            | "meal"
            | "snack"
            | "steps"
            | "activity_hours";
          icon: string;
          accent: string;
          sort_order: number;
          category_id: string | null;
          enabled: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          label: string;
          kind?:
            | "tri_state"
            | "water"
            | "meal"
            | "snack"
            | "steps"
            | "activity_hours";
          icon?: string;
          accent?: string;
          sort_order?: number;
          category_id?: string | null;
          enabled?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key?: string;
          label?: string;
          kind?:
            | "tri_state"
            | "water"
            | "meal"
            | "snack"
            | "steps"
            | "activity_hours";
          icon?: string;
          accent?: string;
          sort_order?: number;
          category_id?: string | null;
          enabled?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_categories: {
        Row: {
          id: string;
          user_id: string;
          scope: "daily" | "weekly" | "monthly";
          name: string;
          icon: string;
          accent: string;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scope: "daily" | "weekly" | "monthly";
          name: string;
          icon?: string;
          accent?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scope?: "daily" | "weekly" | "monthly";
          name?: string;
          icon?: string;
          accent?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weekly_tasks: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          title: string;
          notes: string | null;
          icon: string;
          accent: string;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          title: string;
          notes?: string | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          title?: string;
          notes?: string | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weekly_task_placements: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          week_start: string;
          weekday: number;
          done_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          week_start: string;
          weekday: number;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          week_start?: string;
          weekday?: number;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monthly_tasks: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          title: string;
          notes: string | null;
          day_of_month: number | null;
          icon: string;
          accent: string;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          title: string;
          notes?: string | null;
          day_of_month?: number | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          title?: string;
          notes?: string | null;
          day_of_month?: number | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monthly_task_completions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          month_start: string;
          done_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          month_start: string;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          month_start?: string;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meal_entries: {
        Row: {
          id: string;
          user_id: string;
          local_date: string;
          meal: "breakfast" | "lunch" | "dinner";
          description: string;
          water_log_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          local_date: string;
          meal: "breakfast" | "lunch" | "dinner";
          description: string;
          water_log_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          local_date?: string;
          meal?: "breakfast" | "lunch" | "dinner";
          description?: string;
          water_log_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      habit_checks: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          local_date: string;
          status: "yes" | "half" | "no";
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          local_date: string;
          status: "yes" | "half" | "no";
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          habit_id?: string;
          local_date?: string;
          status?: "yes" | "half" | "no";
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      intake_entries: {
        Row: {
          id: string;
          user_id: string;
          local_date: string;
          kind: "fruit" | "creatine" | "vitamin" | "shake";
          description: string;
          water_log_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          local_date: string;
          kind: "fruit" | "creatine" | "vitamin" | "shake";
          description?: string;
          water_log_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          local_date?: string;
          kind?: "fruit" | "creatine" | "vitamin" | "shake";
          description?: string;
          water_log_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gym_session_templates: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          label: string;
          description: string | null;
          icon: string;
          accent: string;
          sort_order: number;
          default_weekday: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key: string;
          label: string;
          description?: string | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          default_weekday: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key?: string;
          label?: string;
          description?: string | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          default_weekday?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gym_week_placements: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          week_start: string;
          weekday: number;
          warmup: "skidor" | "rodd" | "cykel" | "crosstrainer" | "magmaskin" | null;
          done_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id: string;
          week_start: string;
          weekday: number;
          warmup?: "skidor" | "rodd" | "cykel" | "crosstrainer" | "magmaskin" | null;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string;
          week_start?: string;
          weekday?: number;
          warmup?: "skidor" | "rodd" | "cykel" | "crosstrainer" | "magmaskin" | null;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
