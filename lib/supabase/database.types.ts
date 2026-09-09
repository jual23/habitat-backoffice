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
      activities: {
        Row: {
          banner_url: string | null
          building_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          max_participants: number | null
          published: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          building_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          max_participants?: number | null
          published?: boolean
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          building_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          max_participants?: number | null
          published?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_signups: {
        Row: {
          activity_id: string
          apartment_label: string | null
          created_at: string
          full_name: string
          id: string
          participants: number
          user_id: string
        }
        Insert: {
          activity_id: string
          apartment_label?: string | null
          created_at?: string
          full_name: string
          id?: string
          participants?: number
          user_id: string
        }
        Update: {
          activity_id?: string
          apartment_label?: string | null
          created_at?: string
          full_name?: string
          id?: string
          participants?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_signups_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_attachments: {
        Row: {
          announcement_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
        }
        Insert: {
          announcement_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Update: {
          announcement_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          banner_url: string | null
          body: string
          building_id: string
          category: string | null
          created_at: string
          id: string
          pinned: boolean
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          banner_url?: string | null
          body?: string
          building_id: string
          category?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          banner_url?: string | null
          body?: string
          building_id?: string
          category?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          building_id: string
          created_at: string
          floor: number | null
          id: string
          monthly_fee: number | null
          tower: string | null
          unit_number: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          floor?: number | null
          id?: string
          monthly_fee?: number | null
          tower?: string | null
          unit_number: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          floor?: number | null
          id?: string
          monthly_fee?: number | null
          tower?: string | null
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          building_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          building_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          building_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_templates: {
        Row: {
          building_id: string
          created_at: string
          created_by: string
          icon: string | null
          id: string
          message: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          created_by: string
          icon?: string | null
          id?: string
          message: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          created_by?: string
          icon?: string | null
          id?: string
          message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_templates_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          building_id: string
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          icon: string | null
          id: string
          message: string
          sent_by: string
          status: Database["public"]["Enums"]["broadcast_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          icon?: string | null
          id?: string
          message: string
          sent_by: string
          status?: Database["public"]["Enums"]["broadcast_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          icon?: string | null
          id?: string
          message?: string
          sent_by?: string
          status?: Database["public"]["Enums"]["broadcast_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "broadcast_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          accent_color: string
          address: string | null
          created_at: string
          id: string
          late_fee_amount: number | null
          late_fee_type: Database["public"]["Enums"]["late_fee_type"] | null
          logo_url: string | null
          name: string
          payment_available_day: number | null
          payment_due_day: number | null
          staff_broadcast_enabled: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          address?: string | null
          created_at?: string
          id?: string
          late_fee_amount?: number | null
          late_fee_type?: Database["public"]["Enums"]["late_fee_type"] | null
          logo_url?: string | null
          name: string
          payment_available_day?: number | null
          payment_due_day?: number | null
          staff_broadcast_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          address?: string | null
          created_at?: string
          id?: string
          late_fee_amount?: number | null
          late_fee_type?: Database["public"]["Enums"]["late_fee_type"] | null
          logo_url?: string | null
          name?: string
          payment_available_day?: number | null
          payment_due_day?: number | null
          staff_broadcast_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_folders: {
        Row: {
          building_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          building_id: string
          created_at: string
          file_path: string
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          building_id: string
          created_at?: string
          file_path: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          building_id?: string
          created_at?: string
          file_path?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      emergencies: {
        Row: {
          apartment_id: string | null
          building_id: string
          created_at: string
          description: string | null
          id: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["emergency_status"]
        }
        Insert: {
          apartment_id?: string | null
          building_id: string
          created_at?: string
          description?: string | null
          id?: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["emergency_status"]
        }
        Update: {
          apartment_id?: string | null
          building_id?: string
          created_at?: string
          description?: string | null
          id?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["emergency_status"]
        }
        Relationships: [
          {
            foreignKeyName: "emergencies_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergencies_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          building_id: string
          capacity: number | null
          closes_at: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          open_days: number[]
          opens_at: string
          reservable: boolean
          updated_at: string
        }
        Insert: {
          building_id: string
          capacity?: number | null
          closes_at?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          open_days?: number[]
          opens_at?: string
          reservable?: boolean
          updated_at?: string
        }
        Update: {
          building_id?: string
          capacity?: number | null
          closes_at?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          open_days?: number[]
          opens_at?: string
          reservable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          building_id: string
          created_at: string
          discarded_at: string | null
          id: string
          starred: boolean
          subject: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          building_id: string
          created_at?: string
          discarded_at?: string | null
          id?: string
          starred?: boolean
          subject: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          building_id?: string
          created_at?: string
          discarded_at?: string | null
          id?: string
          starred?: boolean
          subject?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          apartment_id: string | null
          building_id: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          apartment_id?: string | null
          building_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          apartment_id?: string | null
          building_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_completions: {
        Row: {
          building_id: string
          completed_at: string
          completed_by: string
          id: string
          photo_url: string | null
          task_id: string
        }
        Insert: {
          building_id: string
          completed_at?: string
          completed_by: string
          id?: string
          photo_url?: string | null
          task_id: string
        }
        Update: {
          building_id?: string
          completed_at?: string
          completed_by?: string
          id?: string
          photo_url?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_completions_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          building_id: string
          created_at: string
          created_by: string
          frequency: Database["public"]["Enums"]["maintenance_frequency"]
          id: string
          interval_months: number | null
          name: string
          next_due_date: string | null
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          created_by: string
          frequency: Database["public"]["Enums"]["maintenance_frequency"]
          id?: string
          interval_months?: number | null
          name: string
          next_due_date?: string | null
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          created_by?: string
          frequency?: Database["public"]["Enums"]["maintenance_frequency"]
          id?: string
          interval_months?: number | null
          name?: string
          next_due_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      news_comments: {
        Row: {
          announcement_id: string
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          announcement_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          announcement_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      news_reactions: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_reactions_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          building_id: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          building_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          building_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          apartment_id: string
          building_id: string
          created_at: string
          description: string
          id: string
          photo_url: string | null
          picked_up_at: string | null
          registered_by: string
          status: Database["public"]["Enums"]["package_status"]
          updated_at: string
        }
        Insert: {
          apartment_id: string
          building_id: string
          created_at?: string
          description: string
          id?: string
          photo_url?: string | null
          picked_up_at?: string | null
          registered_by: string
          status?: Database["public"]["Enums"]["package_status"]
          updated_at?: string
        }
        Update: {
          apartment_id?: string
          building_id?: string
          created_at?: string
          description?: string
          id?: string
          photo_url?: string | null
          picked_up_at?: string | null
          registered_by?: string
          status?: Database["public"]["Enums"]["package_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          apartment_id: string
          available_date: string
          building_id: string
          confirmation_photo_url: string | null
          created_at: string
          due_date: string
          id: string
          late_fee_amount: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          apartment_id: string
          available_date: string
          building_id: string
          confirmation_photo_url?: string | null
          created_at?: string
          due_date: string
          id?: string
          late_fee_amount?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          apartment_id?: string
          available_date?: string
          building_id?: string
          confirmation_photo_url?: string | null
          created_at?: string
          due_date?: string
          id?: string
          late_fee_amount?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          apartment_id: string
          created_at: string
          id: string
          option_id: string
          poll_id: string
          voter_id: string
        }
        Insert: {
          apartment_id: string
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          voter_id: string
        }
        Update: {
          apartment_id?: string
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_multiple: boolean
          anonymous: boolean
          attachment_url: string | null
          building_id: string
          closes_at: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          anonymous?: boolean
          attachment_url?: string | null
          building_id: string
          closes_at: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          anonymous?: boolean
          attachment_url?: string | null
          building_id?: string
          closes_at?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apartment_id: string | null
          building_id: string | null
          created_at: string
          document_id: string | null
          email: string | null
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          password_set: boolean
          phone: string | null
          tenant_type: Database["public"]["Enums"]["tenant_type"]
          updated_at: string
        }
        Insert: {
          apartment_id?: string | null
          building_id?: string | null
          created_at?: string
          document_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          id: string
          last_name?: string | null
          password_set?: boolean
          phone?: string | null
          tenant_type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Update: {
          apartment_id?: string | null
          building_id?: string | null
          created_at?: string
          document_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          password_set?: boolean
          phone?: string | null
          tenant_type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          building_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          end_time: string
          facility_id: string
          guests: number
          id: string
          note: string | null
          reserved_date: string
          start_time: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          end_time: string
          facility_id: string
          guests?: number
          id?: string
          note?: string | null
          reserved_date: string
          start_time: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          building_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          end_time?: string
          facility_id?: string
          guests?: number
          id?: string
          note?: string | null
          reserved_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          apartment_id: string | null
          building_id: string
          created_at: string
          description: string | null
          duplicate_of_ticket_id: string | null
          id: string
          photo_url: string | null
          rejection_reason: string | null
          reported_by: string
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
        }
        Insert: {
          apartment_id?: string | null
          building_id: string
          created_at?: string
          description?: string | null
          duplicate_of_ticket_id?: string | null
          id?: string
          photo_url?: string | null
          rejection_reason?: string | null
          reported_by: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
        }
        Update: {
          apartment_id?: string | null
          building_id?: string
          created_at?: string
          description?: string | null
          duplicate_of_ticket_id?: string | null
          id?: string
          photo_url?: string | null
          rejection_reason?: string | null
          reported_by?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_duplicate_of_ticket_id_fkey"
            columns: ["duplicate_of_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          building_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          building_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          apartment_id: string | null
          arrived_at: string | null
          building_id: string
          created_at: string
          created_by: string
          document_id: string | null
          expires_at: string
          full_name: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          apartment_id?: string | null
          arrived_at?: string | null
          building_id: string
          created_at?: string
          created_by: string
          document_id?: string | null
          expires_at?: string
          full_name: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          apartment_id?: string | null
          arrived_at?: string | null
          building_id?: string
          created_at?: string
          created_by?: string
          document_id?: string | null
          expires_at?: string
          full_name?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activity_signup_count: {
        Args: { p_activity_id: string }
        Returns: number
      }
      can_admin_building: {
        Args: { _building: string; _user_id: string }
        Returns: boolean
      }
      delete_own_account: { Args: never; Returns: undefined }
      evaluate_payment_due_dates: { Args: never; Returns: undefined }
      expire_visitors: { Args: never; Returns: undefined }
      generate_monthly_payments: { Args: never; Returns: undefined }
      has_building_role: {
        Args: {
          _building: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_app_admin: { Args: { _user_id: string }; Returns: boolean }
      is_building_member: {
        Args: { _building: string; _user_id: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _actor_id: string
          _building_id: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
        }
        Returns: string
      }
      my_building_id: { Args: never; Returns: string }
      purge_discarded_feedback: { Args: never; Returns: undefined }
      storage_building_id: { Args: { _name: string }; Returns: string }
    }
    Enums: {
      app_role: "app_admin" | "building_admin" | "resident" | "staff"
      broadcast_status: "active" | "deactivated"
      emergency_status: "unhandled" | "resolved"
      feedback_type: "suggestion" | "complaint"
      late_fee_type: "flat" | "percent"
      maintenance_frequency: "once" | "weekly" | "monthly" | "every_n_months"
      package_status: "pending" | "picked_up"
      payment_status: "pending" | "submitted" | "received" | "overdue"
      reservation_status: "requested" | "approved" | "declined" | "cancelled"
      tenant_type: "resident" | "renter"
      ticket_status:
        | "pending"
        | "in_progress"
        | "rejected"
        | "resolved"
        | "duplicate"
      visitor_status: "pending" | "arrived" | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["app_admin", "building_admin", "resident", "staff"],
      broadcast_status: ["active", "deactivated"],
      emergency_status: ["unhandled", "resolved"],
      feedback_type: ["suggestion", "complaint"],
      late_fee_type: ["flat", "percent"],
      maintenance_frequency: ["once", "weekly", "monthly", "every_n_months"],
      package_status: ["pending", "picked_up"],
      payment_status: ["pending", "submitted", "received", "overdue"],
      reservation_status: ["requested", "approved", "declined", "cancelled"],
      tenant_type: ["resident", "renter"],
      ticket_status: [
        "pending",
        "in_progress",
        "rejected",
        "resolved",
        "duplicate",
      ],
      visitor_status: ["pending", "arrived", "expired"],
    },
  },
} as const
