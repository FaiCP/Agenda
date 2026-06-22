export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      whatsapp_conversations: {
        Row: {
          chat_id: string
          created_at: string
          organization_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          organization_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          organization_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          connected_at: string | null
          created_at: string
          last_qr_at: string | null
          organization_id: string
          phone: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          last_qr_at?: string | null
          organization_id: string
          phone?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          last_qr_at?: string | null
          organization_id?: string
          phone?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          client_id: string
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          organization_id: string
          origin: Database["public"]["Enums"]["appointment_origin"]
          professional_id: string
          reminder_sent_at: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          cancellation_reason?: string | null
          client_id: string
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          organization_id: string
          origin?: Database["public"]["Enums"]["appointment_origin"]
          professional_id: string
          reminder_sent_at?: string | null
          service_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          cancellation_reason?: string | null
          client_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          origin?: Database["public"]["Enums"]["appointment_origin"]
          professional_id?: string
          reminder_sent_at?: string | null
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          organization_id: string
          record_entry_id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          organization_id: string
          record_entry_id: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          record_entry_id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_record_entry_id_fkey"
            columns: ["record_entry_id"]
            isOneToOne: false
            referencedRelation: "record_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exceptions: {
        Row: {
          date: string
          end_time: string | null
          id: string
          is_blocked: boolean
          organization_id: string
          professional_id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          date: string
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          organization_id: string
          professional_id: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          date?: string
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          organization_id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          end_time: string
          id: string
          organization_id: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          organization_id: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          organization_id?: string
          professional_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string
          document_id: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          document_id?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          document_id?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          error: string | null
          format: Database["public"]["Enums"]["media_format"]
          id: string
          organization_id: string
          output_path: string | null
          render_id: string | null
          source_paths: string[]
          status: Database["public"]["Enums"]["media_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          error?: string | null
          format?: Database["public"]["Enums"]["media_format"]
          id?: string
          organization_id: string
          output_path?: string | null
          render_id?: string | null
          source_paths?: string[]
          status?: Database["public"]["Enums"]["media_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          error?: string | null
          format?: Database["public"]["Enums"]["media_format"]
          id?: string
          organization_id?: string
          output_path?: string | null
          render_id?: string | null
          source_paths?: string[]
          status?: Database["public"]["Enums"]["media_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepts_appointments: boolean
          created_at: string
          display_name: string | null
          id: string
          organization_id: string
          profile_id: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          accepts_appointments?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          accepts_appointments?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          booking_enabled: boolean
          branding: Json
          client_label: string
          created_at: string
          currency: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          timezone: string
          vertical: Database["public"]["Enums"]["vertical_type"]
        }
        Insert: {
          address?: string | null
          booking_enabled?: boolean
          branding?: Json
          client_label?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          timezone?: string
          vertical?: Database["public"]["Enums"]["vertical_type"]
        }
        Update: {
          address?: string | null
          booking_enabled?: boolean
          branding?: Json
          client_label?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          timezone?: string
          vertical?: Database["public"]["Enums"]["vertical_type"]
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          organization_id: string
          plan_id: string | null
          receipt_path: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          organization_id: string
          plan_id?: string | null
          receipt_path?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          organization_id?: string
          plan_id?: string | null
          receipt_path?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          code: string
          features: Json
          id: string
          max_appointments_per_month: number | null
          max_professionals: number
          name: string
          price_monthly: number
        }
        Insert: {
          active?: boolean
          code: string
          features?: Json
          id?: string
          max_appointments_per_month?: number | null
          max_professionals?: number
          name: string
          price_monthly?: number
        }
        Update: {
          active?: boolean
          code?: string
          features?: Json
          id?: string
          max_appointments_per_month?: number | null
          max_professionals?: number
          name?: string
          price_monthly?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_superadmin: boolean
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_superadmin?: boolean
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_superadmin?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      record_entries: {
        Row: {
          appointment_id: string | null
          author_id: string | null
          created_at: string
          data: Json
          id: string
          notes: string | null
          organization_id: string
          record_id: string
          title: string | null
        }
        Insert: {
          appointment_id?: string | null
          author_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          notes?: string | null
          organization_id: string
          record_id: string
          title?: string | null
        }
        Update: {
          appointment_id?: string | null
          author_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          notes?: string | null
          organization_id?: string
          record_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "record_entries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_entries_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_entries_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      record_template_fields: {
        Row: {
          field_key: string
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          label: string
          options: Json | null
          required: boolean
          sort_order: number
          template_id: string
        }
        Insert: {
          field_key: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          template_id: string
        }
        Update: {
          field_key?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "record_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      record_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          vertical: Database["public"]["Enums"]["vertical_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          vertical: Database["public"]["Enums"]["vertical_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          vertical?: Database["public"]["Enums"]["vertical_type"]
        }
        Relationships: [
          {
            foreignKeyName: "record_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          client_id: string
          created_at: string
          id: string
          organization_id: string
          template_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          organization_id: string
          template_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "record_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          appointment_id: string
          channel: string
          id: string
          organization_id: string
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
        }
        Insert: {
          appointment_id: string
          channel?: string
          id?: string
          organization_id: string
          scheduled_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
        }
        Update: {
          appointment_id?: string
          channel?: string
          id?: string
          organization_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          allow_public_booking: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          modality: Database["public"]["Enums"]["service_modality"]
          name: string
          organization_id: string
          price: number
        }
        Insert: {
          active?: boolean
          allow_public_booking?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          modality?: Database["public"]["Enums"]["service_modality"]
          name: string
          organization_id: string
          price?: number
        }
        Update: {
          active?: boolean
          allow_public_booking?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          modality?: Database["public"]["Enums"]["service_modality"]
          name?: string
          organization_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          organization_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          organization_id: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          organization_id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      client_risk_stats: {
        Args: { p_organization_id: string }
        Returns: {
          client_id: string
          full_name: string
          phone: string | null
          email: string | null
          client_since: string
          completed: number
          no_shows: number
          cancelled: number
          first_visit: string | null
          last_visit: string | null
          next_appointment: string | null
        }[]
      }
      create_organization: {
        Args: {
          p_client_label: string
          p_create_examples: boolean
          p_example_services: Json
          p_name: string
          p_phone: string
          p_vertical: Database["public"]["Enums"]["vertical_type"]
        }
        Returns: {
          address: string | null
          booking_enabled: boolean
          branding: Json
          client_label: string
          created_at: string
          currency: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          timezone: string
          vertical: Database["public"]["Enums"]["vertical_type"]
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_public_appointment: {
        Args: {
          org_slug: string
          p_client_email: string
          p_client_name: string
          p_client_phone: string
          p_notes?: string
          p_professional_id: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: Json
      }
      get_available_slots: {
        Args: {
          org_slug: string
          p_date: string
          p_professional_id: string
          p_service_id: string
        }
        Returns: Json
      }
      get_public_booking_info: { Args: { org_slug: string }; Returns: Json }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_org_owner: { Args: { org: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
    }
    Enums: {
      appointment_origin: "internal" | "public" | "whatsapp"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      field_type:
        | "text"
        | "textarea"
        | "number"
        | "date"
        | "select"
        | "multiselect"
        | "boolean"
      media_format: "reel" | "post" | "story"
      media_status: "pending" | "rendering" | "ready" | "failed"
      member_role: "owner" | "professional" | "receptionist"
      payment_status: "pending_review" | "approved" | "rejected"
      reminder_status: "scheduled" | "sent" | "failed" | "cancelled"
      service_modality: "in_person" | "virtual" | "both"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
      vertical_type:
        | "medical"
        | "legal"
        | "psychology"
        | "dental"
        | "aesthetics"
        | "generic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals["public"]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_origin: ["internal", "public", "whatsapp"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      field_type: [
        "text",
        "textarea",
        "number",
        "date",
        "select",
        "multiselect",
        "boolean",
      ],
      media_format: ["reel", "post", "story"],
      media_status: ["pending", "rendering", "ready", "failed"],
      member_role: ["owner", "professional", "receptionist"],
      payment_status: ["pending_review", "approved", "rejected"],
      reminder_status: ["scheduled", "sent", "failed", "cancelled"],
      service_modality: ["in_person", "virtual", "both"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
      vertical_type: [
        "medical",
        "legal",
        "psychology",
        "dental",
        "aesthetics",
        "generic",
      ],
    },
  },
} as const
