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
          default_weight_weekday: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          daily_water_goal_ml?: number;
          daily_steps_goal?: number;
          daily_activity_hours_goal?: number;
          default_weight_weekday?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          daily_water_goal_ml?: number;
          daily_steps_goal?: number;
          daily_activity_hours_goal?: number;
          default_weight_weekday?: number | null;
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
          description: string;
          done_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          local_date: string;
          slot: number;
          description?: string;
          done_at?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          slot?: number;
          description?: string;
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
            | "intake"
            | "steps"
            | "activity_hours"
            | "media"
            | "mobile_games"
            | "mood";
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
            | "intake"
            | "steps"
            | "activity_hours"
            | "media"
            | "mobile_games"
            | "mood";
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
            | "intake"
            | "steps"
            | "activity_hours"
            | "media"
            | "mobile_games"
            | "mood";
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
      media_items: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          kind: "book" | "series" | "movie";
          title: string;
          total_length: number | null;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          kind: "book" | "series" | "movie";
          title: string;
          total_length?: number | null;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          kind?: "book" | "series" | "movie";
          title?: string;
          total_length?: number | null;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_daily_logs: {
        Row: {
          id: string;
          user_id: string;
          media_item_id: string;
          local_date: string;
          position: number;
          did_consume: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_item_id: string;
          local_date: string;
          position?: number;
          did_consume?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_item_id?: string;
          local_date?: string;
          position?: number;
          did_consume?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mobile_game_daily_logs: {
        Row: {
          user_id: string;
          local_date: string;
          chess_done: boolean;
          duolingo_done: boolean;
          pokemon_go_done: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          local_date: string;
          chess_done?: boolean;
          duolingo_done?: boolean;
          pokemon_go_done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          chess_done?: boolean;
          duolingo_done?: boolean;
          pokemon_go_done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mood_daily_logs: {
        Row: {
          user_id: string;
          local_date: string;
          mood: "angry" | "sad" | "stressed" | "tired" | "happy" | "joyful";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          local_date: string;
          mood: "angry" | "sad" | "stressed" | "tired" | "happy" | "joyful";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          mood?: "angry" | "sad" | "stressed" | "tired" | "happy" | "joyful";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          local_date: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          local_date: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          local_date?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_daily_logs: {
        Row: {
          user_id: string;
          local_date: string;
          started_at: string | null;
          start_note: string | null;
          ended_at: string | null;
          end_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          local_date: string;
          started_at?: string | null;
          start_note?: string | null;
          ended_at?: string | null;
          end_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          started_at?: string | null;
          start_note?: string | null;
          ended_at?: string | null;
          end_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_plan_orders: {
        Row: {
          user_id: string;
          local_date: string;
          item_key: string;
          sort_order: number;
        };
        Insert: {
          user_id: string;
          local_date: string;
          item_key: string;
          sort_order?: number;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          item_key?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      task_categories: {
        Row: {
          id: string;
          user_id: string;
          scope: "daily" | "weekly" | "monthly" | "task";
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
          scope: "daily" | "weekly" | "monthly" | "task";
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
          scope?: "daily" | "weekly" | "monthly" | "task";
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
          key: string | null;
          title: string;
          notes: string | null;
          icon: string;
          accent: string;
          sort_order: number;
          default_weekday: number | null;
          single_week_start: string | null;
          completion_kind: "simple" | "shop" | "journal" | "laundry" | "music";
          enabled: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          key?: string | null;
          title: string;
          notes?: string | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          default_weekday?: number | null;
          single_week_start?: string | null;
          completion_kind?: "simple" | "shop" | "journal" | "laundry";
          enabled?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          key?: string | null;
          title?: string;
          notes?: string | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          default_weekday?: number | null;
          single_week_start?: string | null;
          completion_kind?: "simple" | "shop" | "journal" | "laundry";
          enabled?: boolean;
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
          weekday: number | null;
          day_sort_order: number;
          done_at: string | null;
          plan_note: string | null;
          note: string | null;
          shop_location: string | null;
          shop_amount: number | null;
          laundry_loads: number | null;
          band: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          week_start: string;
          weekday?: number | null;
          day_sort_order?: number;
          done_at?: string | null;
          plan_note?: string | null;
          note?: string | null;
          shop_location?: string | null;
          shop_amount?: number | null;
          laundry_loads?: number | null;
          band?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          week_start?: string;
          weekday?: number | null;
          day_sort_order?: number;
          done_at?: string | null;
          plan_note?: string | null;
          note?: string | null;
          shop_location?: string | null;
          shop_amount?: number | null;
          laundry_loads?: number | null;
          band?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weekly_task_checklist_items: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          text: string;
          done_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          text: string;
          done_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          text?: string;
          done_at?: string | null;
          sort_order?: number;
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
          key: string | null;
          title: string;
          notes: string | null;
          day_of_month: number | null;
          icon: string;
          accent: string;
          sort_order: number;
          completion_kind: "simple" | "amount" | "finance";
          single_month_start: string | null;
          default_amount_kr: number | null;
          enabled: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          key?: string | null;
          title: string;
          notes?: string | null;
          day_of_month?: number | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          completion_kind?: "simple" | "amount" | "finance";
          single_month_start?: string | null;
          default_amount_kr?: number | null;
          enabled?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          key?: string | null;
          title?: string;
          notes?: string | null;
          day_of_month?: number | null;
          icon?: string;
          accent?: string;
          sort_order?: number;
          completion_kind?: "simple" | "amount" | "finance";
          single_month_start?: string | null;
          default_amount_kr?: number | null;
          enabled?: boolean;
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
          amount: number | null;
          scheduled_day_of_month: number | null;
          scheduled_week_start: string | null;
          is_unscheduled: boolean;
          day_sort_order: number;
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
          amount?: number | null;
          scheduled_day_of_month?: number | null;
          scheduled_week_start?: string | null;
          is_unscheduled?: boolean;
          day_sort_order?: number;
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
          amount?: number | null;
          scheduled_day_of_month?: number | null;
          scheduled_week_start?: string | null;
          is_unscheduled?: boolean;
          day_sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monthly_finance_snapshots: {
        Row: {
          id: string;
          user_id: string;
          month_start: string;
          langforsakringar: number | null;
          kort: number | null;
          spar: number | null;
          isk: number | null;
          sbab_spar: number | null;
          avanza: number | null;
          krypto: number | null;
          cash: number | null;
          note: string | null;
          done_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_start: string;
          langforsakringar?: number | null;
          kort?: number | null;
          spar?: number | null;
          isk?: number | null;
          sbab_spar?: number | null;
          avanza?: number | null;
          krypto?: number | null;
          cash?: number | null;
          note?: string | null;
          done_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month_start?: string;
          langforsakringar?: number | null;
          kort?: number | null;
          spar?: number | null;
          isk?: number | null;
          sbab_spar?: number | null;
          avanza?: number | null;
          krypto?: number | null;
          cash?: number | null;
          note?: string | null;
          done_at?: string | null;
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
          cooked_by:
            | "self"
            | "julia"
            | "bought"
            | "restaurant"
            | "other"
            | "meal_box"
            | null;
          meal_boxes: number | null;
          restaurant_id: string | null;
          cooked_by_name: string | null;
          from_meal_box: boolean;
          meal_box_stock_id: string | null;
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
          cooked_by?:
            | "self"
            | "julia"
            | "bought"
            | "restaurant"
            | "other"
            | "meal_box"
            | null;
          meal_boxes?: number | null;
          restaurant_id?: string | null;
          cooked_by_name?: string | null;
          from_meal_box?: boolean;
          meal_box_stock_id?: string | null;
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
          cooked_by?:
            | "self"
            | "julia"
            | "bought"
            | "restaurant"
            | "other"
            | "meal_box"
            | null;
          meal_boxes?: number | null;
          restaurant_id?: string | null;
          cooked_by_name?: string | null;
          from_meal_box?: boolean;
          meal_box_stock_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_entries_meal_box_stock_id_fkey";
            columns: ["meal_box_stock_id"];
            isOneToOne: false;
            referencedRelation: "meal_box_stock";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_entries_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "meal_restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      meal_box_stock: {
        Row: {
          id: string;
          user_id: string;
          description: string;
          remaining: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          description: string;
          remaining?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          description?: string;
          remaining?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meal_restaurants: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
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
          weekday: number | null;
          day_sort_order: number;
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
          weekday?: number | null;
          day_sort_order?: number;
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
          weekday?: number | null;
          day_sort_order?: number;
          warmup?: "skidor" | "rodd" | "cykel" | "crosstrainer" | "magmaskin" | null;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cardio_session_templates: {
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
      cardio_week_placements: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          week_start: string;
          weekday: number | null;
          day_sort_order: number;
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
          weekday?: number | null;
          day_sort_order?: number;
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
          weekday?: number | null;
          day_sort_order?: number;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sport_session_templates: {
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
      sport_week_placements: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          week_start: string;
          weekday: number | null;
          day_sort_order: number;
          plan_sport: string | null;
          actual_sport: string | null;
          note: string | null;
          companions: string | null;
          done_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id: string;
          week_start: string;
          weekday?: number | null;
          day_sort_order?: number;
          plan_sport?: string | null;
          actual_sport?: string | null;
          note?: string | null;
          companions?: string | null;
          done_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string;
          week_start?: string;
          weekday?: number | null;
          day_sort_order?: number;
          plan_sport?: string | null;
          actual_sport?: string | null;
          note?: string | null;
          companions?: string | null;
          done_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bathing_session_templates: {
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
      bathing_week_placements: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          week_start: string;
          weekday: number | null;
          day_sort_order: number;
          water_temp_c: number | null;
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
          weekday?: number | null;
          day_sort_order?: number;
          water_temp_c?: number | null;
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
          weekday?: number | null;
          day_sort_order?: number;
          water_temp_c?: number | null;
          done_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weight_week_plans: {
        Row: {
          user_id: string;
          week_start: string;
          enabled: boolean;
          weekday: number | null;
          day_sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          week_start: string;
          enabled?: boolean;
          weekday?: number | null;
          day_sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          week_start?: string;
          enabled?: boolean;
          weekday?: number | null;
          day_sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weight_logs: {
        Row: {
          user_id: string;
          local_date: string;
          time_of_day: string;
          weight_kg: number;
          logged_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          local_date: string;
          time_of_day: string;
          weight_kg: number;
          logged_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          local_date?: string;
          time_of_day?: string;
          weight_kg?: number;
          logged_at?: string;
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
