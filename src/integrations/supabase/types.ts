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
      bid_proposals: {
        Row: {
          amount: number | null
          bid_request_id: string
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          id: string
          message: string | null
          portfolio_url: string | null
          provider_id: string
          status: Database["public"]["Enums"]["bid_proposal_status"]
          timeline_days: number | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          bid_request_id: string
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          message?: string | null
          portfolio_url?: string | null
          provider_id: string
          status?: Database["public"]["Enums"]["bid_proposal_status"]
          timeline_days?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          bid_request_id?: string
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          message?: string | null
          portfolio_url?: string | null
          provider_id?: string
          status?: Database["public"]["Enums"]["bid_proposal_status"]
          timeline_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_proposals_bid_request_id_fkey"
            columns: ["bid_request_id"]
            isOneToOne: false
            referencedRelation: "bid_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_requests: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: Database["public"]["Enums"]["bid_category"]
          county: string | null
          created_at: string
          currency: string
          id: string
          owner_id: string
          property_id: string | null
          scope: string
          status: Database["public"]["Enums"]["bid_request_status"]
          timeline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: Database["public"]["Enums"]["bid_category"]
          county?: string | null
          created_at?: string
          currency?: string
          id?: string
          owner_id: string
          property_id?: string | null
          scope: string
          status?: Database["public"]["Enums"]["bid_request_status"]
          timeline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: Database["public"]["Enums"]["bid_category"]
          county?: string | null
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string
          property_id?: string | null
          scope?: string
          status?: Database["public"]["Enums"]["bid_request_status"]
          timeline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      financing_applications: {
        Row: {
          ai_summary: Json | null
          applicant_id: string
          borrower_email: string | null
          borrower_name: string
          borrower_phone: string | null
          created_at: string
          currency: string
          employment_status: string | null
          id: string
          lender_name: string | null
          monthly_income: number | null
          notes: string | null
          property_address: string | null
          property_id: string | null
          property_value: number | null
          purpose: Database["public"]["Enums"]["financing_purpose"]
          requested_amount: number
          status: Database["public"]["Enums"]["financing_status"]
          tenure_months: number | null
          updated_at: string
        }
        Insert: {
          ai_summary?: Json | null
          applicant_id: string
          borrower_email?: string | null
          borrower_name: string
          borrower_phone?: string | null
          created_at?: string
          currency?: string
          employment_status?: string | null
          id?: string
          lender_name?: string | null
          monthly_income?: number | null
          notes?: string | null
          property_address?: string | null
          property_id?: string | null
          property_value?: number | null
          purpose?: Database["public"]["Enums"]["financing_purpose"]
          requested_amount: number
          status?: Database["public"]["Enums"]["financing_status"]
          tenure_months?: number | null
          updated_at?: string
        }
        Update: {
          ai_summary?: Json | null
          applicant_id?: string
          borrower_email?: string | null
          borrower_name?: string
          borrower_phone?: string | null
          created_at?: string
          currency?: string
          employment_status?: string | null
          id?: string
          lender_name?: string | null
          monthly_income?: number | null
          notes?: string | null
          property_address?: string | null
          property_id?: string | null
          property_value?: number | null
          purpose?: Database["public"]["Enums"]["financing_purpose"]
          requested_amount?: number
          status?: Database["public"]["Enums"]["financing_status"]
          tenure_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financing_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_briefs: {
        Row: {
          ai_output: Json
          created_at: string
          generated_by: string | null
          id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          ai_output: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          ai_output?: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_briefs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          buyer_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          message: string | null
          property_id: string
          seller_id: string
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
        }
        Insert: {
          buyer_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          message?: string | null
          property_id: string
          seller_id: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          message?: string | null
          property_id?: string
          seller_id?: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          ai_score: Json | null
          ai_summary: Json | null
          amenities: string[]
          bathrooms: number | null
          bedrooms: number | null
          completeness_pct: number
          county: string | null
          cover_image: string | null
          created_at: string
          currency: string
          description: string | null
          featured: boolean
          id: string
          intent: Database["public"]["Enums"]["listing_intent"]
          kind: Database["public"]["Enums"]["property_kind"]
          latitude: number | null
          longitude: number | null
          media_urls: string[]
          owner_id: string
          price: number | null
          review_state: string
          size_unit: string | null
          size_value: number | null
          status: Database["public"]["Enums"]["property_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          utilities: string[]
          view_count: number
        }
        Insert: {
          address?: string | null
          ai_score?: Json | null
          ai_summary?: Json | null
          amenities?: string[]
          bathrooms?: number | null
          bedrooms?: number | null
          completeness_pct?: number
          county?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          id?: string
          intent?: Database["public"]["Enums"]["listing_intent"]
          kind: Database["public"]["Enums"]["property_kind"]
          latitude?: number | null
          longitude?: number | null
          media_urls?: string[]
          owner_id: string
          price?: number | null
          review_state?: string
          size_unit?: string | null
          size_value?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          submitted_at?: string | null
          title: string
          updated_at?: string
          utilities?: string[]
          view_count?: number
        }
        Update: {
          address?: string | null
          ai_score?: Json | null
          ai_summary?: Json | null
          amenities?: string[]
          bathrooms?: number | null
          bedrooms?: number | null
          completeness_pct?: number
          county?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          id?: string
          intent?: Database["public"]["Enums"]["listing_intent"]
          kind?: Database["public"]["Enums"]["property_kind"]
          latitude?: number | null
          longitude?: number | null
          media_urls?: string[]
          owner_id?: string
          price?: number | null
          review_state?: string
          size_unit?: string | null
          size_value?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
          utilities?: string[]
          view_count?: number
        }
        Relationships: []
      }
      property_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          position: number
          property_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          property_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_details: {
        Row: {
          accessibility_features: string[]
          available_from: string | null
          bathrooms: number | null
          bedrooms: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          deposit: number | null
          furnishing: string | null
          house_rules: string | null
          monthly_rent: number | null
          parking_spaces: number | null
          property_id: string
          public_transport: string | null
          security_features: string[]
          service_charge: number | null
          updated_at: string
          utilities_included: string[]
          viewing_instructions: string | null
        }
        Insert: {
          accessibility_features?: string[]
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          deposit?: number | null
          furnishing?: string | null
          house_rules?: string | null
          monthly_rent?: number | null
          parking_spaces?: number | null
          property_id: string
          public_transport?: string | null
          security_features?: string[]
          service_charge?: number | null
          updated_at?: string
          utilities_included?: string[]
          viewing_instructions?: string | null
        }
        Update: {
          accessibility_features?: string[]
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          deposit?: number | null
          furnishing?: string | null
          house_rules?: string | null
          monthly_rent?: number | null
          parking_spaces?: number | null
          property_id?: string
          public_transport?: string | null
          security_features?: string[]
          service_charge?: number | null
          updated_at?: string
          utilities_included?: string[]
          viewing_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      renter_preferences: {
        Row: {
          accessibility_needed: boolean
          amenities: string[]
          bedrooms_min: number | null
          budget_max: number | null
          budget_min: number | null
          commute_preference: string | null
          counties: string[]
          created_at: string
          personalization_enabled: boolean
          schools_priority: number
          security_priority: number
          towns: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          accessibility_needed?: boolean
          amenities?: string[]
          bedrooms_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          commute_preference?: string | null
          counties?: string[]
          created_at?: string
          personalization_enabled?: boolean
          schools_priority?: number
          security_priority?: number
          towns?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          accessibility_needed?: boolean
          amenities?: string[]
          bedrooms_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          commute_preference?: string | null
          counties?: string[]
          created_at?: string
          personalization_enabled?: boolean
          schools_priority?: number
          security_priority?: number
          towns?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean
          kind: string
          label: string
          latitude: number | null
          longitude: number | null
          note: string | null
          ref: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          kind: string
          label: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          ref: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          kind?: string
          label?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          ref?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          id: string
          label: string
          query: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          id?: string
          label: string
          query: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          id?: string
          label?: string
          query?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      viewings: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          notes: string | null
          property_id: string
          scheduled_at: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          scheduled_at: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          scheduled_at?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      listing_save_count: { Args: { p_property_id: string }; Returns: number }
    }
    Enums: {
      bid_category:
        | "construction"
        | "architecture"
        | "surveying"
        | "legal"
        | "engineering"
        | "landscaping"
        | "other"
      bid_proposal_status:
        | "submitted"
        | "shortlisted"
        | "accepted"
        | "rejected"
        | "withdrawn"
      bid_request_status: "open" | "awarded" | "closed"
      financing_purpose:
        | "purchase"
        | "construction"
        | "refinance"
        | "bridge"
        | "equity_release"
        | "other"
      financing_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "funded"
        | "withdrawn"
      lead_stage:
        | "new"
        | "contacted"
        | "viewing"
        | "negotiation"
        | "offer"
        | "closed"
        | "lost"
      listing_intent: "sale" | "rent" | "lease"
      property_kind:
        | "land"
        | "house"
        | "apartment"
        | "rental"
        | "commercial"
        | "industrial"
        | "agricultural"
        | "mixed_use"
        | "other"
      property_status: "draft" | "published" | "sold" | "rented" | "archived"
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
      bid_category: [
        "construction",
        "architecture",
        "surveying",
        "legal",
        "engineering",
        "landscaping",
        "other",
      ],
      bid_proposal_status: [
        "submitted",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      bid_request_status: ["open", "awarded", "closed"],
      financing_purpose: [
        "purchase",
        "construction",
        "refinance",
        "bridge",
        "equity_release",
        "other",
      ],
      financing_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "funded",
        "withdrawn",
      ],
      lead_stage: [
        "new",
        "contacted",
        "viewing",
        "negotiation",
        "offer",
        "closed",
        "lost",
      ],
      listing_intent: ["sale", "rent", "lease"],
      property_kind: [
        "land",
        "house",
        "apartment",
        "rental",
        "commercial",
        "industrial",
        "agricultural",
        "mixed_use",
        "other",
      ],
      property_status: ["draft", "published", "sold", "rented", "archived"],
    },
  },
} as const
