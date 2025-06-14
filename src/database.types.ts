export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin: boolean
          created_at: string
          id: number
          name: string | null
          organization: string | null
          user_id: string | null
        }
        Insert: {
          admin?: boolean
          created_at?: string
          id?: number
          name?: string | null
          organization?: string | null
          user_id?: string | null
        }
        Update: {
          admin?: boolean
          created_at?: string
          id?: number
          name?: string | null
          organization?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reserve_group_relations: {
        Row: {
          created_at: string
          group_id: number | null
          id: number
          reserve_id: number | null
        }
        Insert: {
          created_at?: string
          group_id?: number | null
          id?: number
          reserve_id?: number | null
        }
        Update: {
          created_at?: string
          group_id?: number | null
          id?: number
          reserve_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reserve_group_relations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_group_relations_reserve_id_fkey"
            columns: ["reserve_id"]
            isOneToOne: false
            referencedRelation: "reserves"
            referencedColumns: ["id"]
          },
        ]
      }
      reserve_groups: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      reserve_member_relations: {
        Row: {
          created_at: string
          id: number
          member_id: number | null
          reserve_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          member_id?: number | null
          reserve_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          member_id?: number | null
          reserve_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reserve_member_relations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_member_relations_reserve_id_fkey"
            columns: ["reserve_id"]
            isOneToOne: false
            referencedRelation: "reserves"
            referencedColumns: ["id"]
          },
        ]
      }
      reserve_relations: {
        Row: {
          created_at: string
          id: number
          reserve_group_id: number | null
          reserve_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          reserve_group_id?: number | null
          reserve_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          reserve_group_id?: number | null
          reserve_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reserve_relations_reserve_group_id_fkey"
            columns: ["reserve_group_id"]
            isOneToOne: false
            referencedRelation: "reserve_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_relations_reserve_id_fkey"
            columns: ["reserve_id"]
            isOneToOne: false
            referencedRelation: "reserves"
            referencedColumns: ["id"]
          },
        ]
      }
      reserves: {
        Row: {
          created_at: string
          description: string | null
          end_time: string | null
          id: number
          start_time: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: number
          start_time?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: number
          start_time?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_group_relations: {
        Row: {
          created_at: string
          group_id: number | null
          id: number
          user_id: number | null
        }
        Insert: {
          created_at?: string
          group_id?: number | null
          id?: number
          user_id?: number | null
        }
        Update: {
          created_at?: string
          group_id?: number | null
          id?: number
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_group_relations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_relations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
