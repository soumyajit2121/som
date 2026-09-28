export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: { Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_roles: {
        Row: {
          code: string;
          description: string;
          name: string;
        };
        Insert: {
          code: string;
          description?: string;
          name: string;
        };
        Update: {
          code?: string;
          description?: string;
          name?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after_values: Json | null;
          before_values: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_values?: Json | null;
          before_values?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_values?: Json | null;
          before_values?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      match_participants: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          note: string | null;
          profile_id: string;
          responded_at: string | null;
          status: Database["public"]["Enums"]["participation_status"];
          status_updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          note?: string | null;
          profile_id: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["participation_status"];
          status_updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          note?: string | null;
          profile_id?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["participation_status"];
          status_updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "match_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_participants_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_participants_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_participants_status_updated_by_fkey";
            columns: ["status_updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          allow_duplicate: boolean;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          category: Database["public"]["Enums"]["match_category"];
          created_at: string;
          created_by: string | null;
          cricheroes_url: string | null;
          id: string;
          match_date: string;
          notes: string | null;
          opponent_id: string;
          our_team_id: string;
          reporting_at: string | null;
          reporting_time: string | null;
          result_summary: string | null;
          start_time: string;
          starts_at: string;
          status: Database["public"]["Enums"]["match_status"];
          timezone: string;
          title: string;
          tournament_id: string | null;
          updated_at: string;
          venue_id: string | null;
        };
        Insert: {
          allow_duplicate?: boolean;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          category: Database["public"]["Enums"]["match_category"];
          created_at?: string;
          created_by?: string | null;
          cricheroes_url?: string | null;
          id?: string;
          match_date: string;
          notes?: string | null;
          opponent_id: string;
          our_team_id: string;
          reporting_at?: string | null;
          reporting_time?: string | null;
          result_summary?: string | null;
          start_time: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["match_status"];
          timezone?: string;
          title: string;
          tournament_id?: string | null;
          updated_at?: string;
          venue_id?: string | null;
        };
        Update: {
          allow_duplicate?: boolean;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          category?: Database["public"]["Enums"]["match_category"];
          created_at?: string;
          created_by?: string | null;
          cricheroes_url?: string | null;
          id?: string;
          match_date?: string;
          notes?: string | null;
          opponent_id?: string;
          our_team_id?: string;
          reporting_at?: string | null;
          reporting_time?: string | null;
          result_summary?: string | null;
          start_time?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["match_status"];
          timezone?: string;
          title?: string;
          tournament_id?: string | null;
          updated_at?: string;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_opponent_id_fkey";
            columns: ["opponent_id"];
            isOneToOne: false;
            referencedRelation: "opponents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_our_team_id_fkey";
            columns: ["our_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          attempts: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          id: string;
          last_attempt_at: string | null;
          last_error: string | null;
          max_attempts: number;
          next_attempt_at: string;
          notification_id: string;
          response_code: number | null;
          status: Database["public"]["Enums"]["delivery_status"];
          subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          notification_id: string;
          response_code?: number | null;
          status?: Database["public"]["Enums"]["delivery_status"];
          subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          notification_id?: string;
          response_code?: number | null;
          status?: Database["public"]["Enums"]["delivery_status"];
          subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_deliveries_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "push_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          profile_id: string;
          push_announcements: boolean;
          push_enabled: boolean;
          push_match_updates: boolean;
          push_operational_alerts: boolean;
          push_player_confirmations: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          profile_id: string;
          push_announcements?: boolean;
          push_enabled?: boolean;
          push_match_updates?: boolean;
          push_operational_alerts?: boolean;
          push_player_confirmations?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          profile_id?: string;
          push_announcements?: boolean;
          push_enabled?: boolean;
          push_match_updates?: boolean;
          push_operational_alerts?: boolean;
          push_player_confirmations?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          dedupe_key: string | null;
          id: string;
          link_path: string | null;
          match_id: string | null;
          read_at: string | null;
          recipient_id: string;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          id?: string;
          link_path?: string | null;
          match_id?: string | null;
          read_at?: string | null;
          recipient_id: string;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          id?: string;
          link_path?: string | null;
          match_id?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "match_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      opponents: {
        Row: {
          created_at: string;
          created_by: string | null;
          dummy_number: number | null;
          id: string;
          is_active: boolean;
          is_dummy: boolean;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          dummy_number?: number | null;
          id?: string;
          is_active?: boolean;
          is_dummy?: boolean;
          name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          dummy_number?: number | null;
          id?: string;
          is_active?: boolean;
          is_dummy?: boolean;
          name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opponents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_private: {
        Row: {
          created_at: string;
          email: string;
          phone: string | null;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          phone?: string | null;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          phone?: string | null;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_private_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          deactivated_at: string | null;
          display_name: string;
          id: string;
          role: string;
          status: Database["public"]["Enums"]["profile_status"];
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          display_name: string;
          id: string;
          role?: string;
          status?: Database["public"]["Enums"]["profile_status"];
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          display_name?: string;
          id?: string;
          role?: string;
          status?: Database["public"]["Enums"]["profile_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "app_roles";
            referencedColumns: ["code"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          device_label: string | null;
          endpoint: string;
          failure_count: number;
          id: string;
          last_success_at: string | null;
          p256dh: string;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          device_label?: string | null;
          endpoint: string;
          failure_count?: number;
          id?: string;
          last_success_at?: string | null;
          p256dh: string;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          device_label?: string | null;
          endpoint?: string;
          failure_count?: number;
          id?: string;
          last_success_at?: string | null;
          p256dh?: string;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_deliveries: {
        Row: {
          conditions: string[];
          created_at: string;
          id: string;
          match_id: string;
          notification_id: string | null;
          occurrence: string;
          recipient_id: string;
          reminder_kind: string;
        };
        Insert: {
          conditions: string[];
          created_at?: string;
          id?: string;
          match_id: string;
          notification_id?: string | null;
          occurrence: string;
          recipient_id: string;
          reminder_kind: string;
        };
        Update: {
          conditions?: string[];
          created_at?: string;
          id?: string;
          match_id?: string;
          notification_id?: string | null;
          occurrence?: string;
          recipient_id?: string;
          reminder_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_deliveries_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "match_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_deliveries_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_deliveries_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      team_memberships: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          joined_at: string;
          left_at: string | null;
          profile_id: string;
          squad_role: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          joined_at?: string;
          left_at?: string | null;
          profile_id: string;
          squad_role?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          joined_at?: string;
          left_at?: string | null;
          profile_id?: string;
          squad_role?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_memberships_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_memberships_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          short_name: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          short_name?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          short_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tournament_enrollments: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          status: Database["public"]["Enums"]["enrollment_status"];
          team_id: string;
          tournament_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["enrollment_status"];
          team_id: string;
          tournament_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["enrollment_status"];
          team_id?: string;
          tournament_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tournament_enrollments_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_enrollments_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      tournaments: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          end_date: string;
          format: string;
          id: string;
          location: string | null;
          name: string;
          notes: string | null;
          organizer: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["tournament_status"];
          updated_at: string;
          venue_id: string | null;
          website_url: string | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          format?: string;
          id?: string;
          location?: string | null;
          name: string;
          notes?: string | null;
          organizer?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["tournament_status"];
          updated_at?: string;
          venue_id?: string | null;
          website_url?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          format?: string;
          id?: string;
          location?: string | null;
          name?: string;
          notes?: string | null;
          organizer?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["tournament_status"];
          updated_at?: string;
          venue_id?: string | null;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          maps_url: string | null;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          maps_url?: string | null;
          name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          maps_url?: string | null;
          name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      match_overview: {
        Row: {
          allow_duplicate: boolean | null;
          available_count: number | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          category: Database["public"]["Enums"]["match_category"] | null;
          confirmed_count: number | null;
          created_at: string | null;
          created_by: string | null;
          created_by_name: string | null;
          cricheroes_url: string | null;
          id: string | null;
          invited_count: number | null;
          match_date: string | null;
          maybe_count: number | null;
          not_responded_count: number | null;
          notes: string | null;
          opponent_id: string | null;
          opponent_is_dummy: boolean | null;
          opponent_name: string | null;
          our_team_id: string | null;
          our_team_name: string | null;
          players_needed: number | null;
          playing_count: number | null;
          reporting_at: string | null;
          reporting_time: string | null;
          result_summary: string | null;
          squad_count: number | null;
          start_time: string | null;
          starts_at: string | null;
          status: Database["public"]["Enums"]["match_status"] | null;
          timezone: string | null;
          title: string | null;
          tournament_id: string | null;
          tournament_name: string | null;
          unavailable_count: number | null;
          updated_at: string | null;
          venue_city: string | null;
          venue_id: string | null;
          venue_maps_url: string | null;
          venue_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_opponent_id_fkey";
            columns: ["opponent_id"];
            isOneToOne: false;
            referencedRelation: "opponents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_our_team_id_fkey";
            columns: ["our_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      claim_push_deliveries: {
        Args: { p_limit: number; p_now?: string };
        Returns: {
          attempts: number;
          auth: string;
          body: string;
          delivery_id: string;
          endpoint: string;
          link_path: string;
          match_id: string;
          max_attempts: number;
          notification_id: string;
          notification_type: Database["public"]["Enums"]["notification_type"];
          p256dh: string;
          subscription_id: string;
          title: string;
        }[];
      };
      create_dummy_opponent: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          created_by: string | null;
          dummy_number: number | null;
          id: string;
          is_active: boolean;
          is_dummy: boolean;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "opponents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      post_announcement: { Args: { p_body: string; p_match_id?: string; p_title: string }; Returns: number };
      record_reminder: {
        Args: {
          p_body: string;
          p_conditions: string[];
          p_link_path: string;
          p_match_id: string;
          p_occurrence: string;
          p_recipient_id: string;
          p_reminder_kind: string;
          p_title: string;
          p_type: Database["public"]["Enums"]["notification_type"];
        };
        Returns: string;
      };
      send_test_notification: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: {
      delivery_status: "pending" | "sending" | "sent" | "failed_temporary" | "failed_permanent" | "expired" | "skipped";
      enrollment_status: "interested" | "applied" | "enrolled" | "withdrawn";
      match_category: "tournament" | "practice";
      match_status: "draft" | "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled";
      notification_channel: "in_app" | "web_push";
      notification_type:
        | "insufficient_players"
        | "dummy_opponent"
        | "readiness_alert"
        | "match_updated"
        | "match_cancelled"
        | "player_confirmed"
        | "general_announcement"
        | "test";
      participation_status: "not_responded" | "available" | "maybe" | "unavailable" | "confirmed" | "playing";
      profile_status: "pending" | "active" | "inactive";
      tournament_status: "upcoming" | "active" | "completed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      delivery_status: ["pending", "sending", "sent", "failed_temporary", "failed_permanent", "expired", "skipped"],
      enrollment_status: ["interested", "applied", "enrolled", "withdrawn"],
      match_category: ["tournament", "practice"],
      match_status: ["draft", "scheduled", "confirmed", "in_progress", "completed", "cancelled"],
      notification_channel: ["in_app", "web_push"],
      notification_type: [
        "insufficient_players",
        "dummy_opponent",
        "readiness_alert",
        "match_updated",
        "match_cancelled",
        "player_confirmed",
        "general_announcement",
        "test",
      ],
      participation_status: ["not_responded", "available", "maybe", "unavailable", "confirmed", "playing"],
      profile_status: ["pending", "active", "inactive"],
      tournament_status: ["upcoming", "active", "completed"],
    },
  },
} as const;
