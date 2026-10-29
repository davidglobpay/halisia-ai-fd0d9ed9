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
      admin_account_controls: {
        Row: {
          actor_id: string | null
          reason: string
          suspended: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          reason: string
          suspended?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          reason?: string
          suspended?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_allowed_emails: {
        Row: {
          created_at: string
          email: string
          enabled: boolean
        }
        Insert: {
          created_at?: string
          email: string
          enabled?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          enabled?: boolean
        }
        Relationships: []
      }
      admin_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          reason: string
          target: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          reason: string
          target: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          reason?: string
          target?: string
        }
        Relationships: []
      }
      architectural_prototypes: {
        Row: {
          category: string | null
          created_at: string
          estimated_cost_kes: number | null
          floors: number | null
          footprint_sqm: number | null
          gltf_url: string | null
          height_m: number | null
          id: string
          title: string
          usdz_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          estimated_cost_kes?: number | null
          floors?: number | null
          footprint_sqm?: number | null
          gltf_url?: string | null
          height_m?: number | null
          id?: string
          title: string
          usdz_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          estimated_cost_kes?: number | null
          floors?: number | null
          footprint_sqm?: number | null
          gltf_url?: string | null
          height_m?: number | null
          id?: string
          title?: string
          usdz_url?: string | null
        }
        Relationships: []
      }
      article_media: {
        Row: {
          article_id: string
          caption: string | null
          created_at: string
          id: string
          media_type: string
          position: number
          url: string
        }
        Insert: {
          article_id: string
          caption?: string | null
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          url: string
        }
        Update: {
          article_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          media_type?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_media_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
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
      boq_labour: {
        Row: {
          created_at: string
          days: number
          finish: string
          id: string
          structure: string
          trade: string
          typology: string
        }
        Insert: {
          created_at?: string
          days: number
          finish: string
          id?: string
          structure: string
          trade: string
          typology: string
        }
        Update: {
          created_at?: string
          days?: number
          finish?: string
          id?: string
          structure?: string
          trade?: string
          typology?: string
        }
        Relationships: []
      }
      boq_template: {
        Row: {
          created_at: string
          finish: string
          floor_area_m2: number
          id: string
          item_code: string
          quantity: number
          quantity_basis: string | null
          structure: string
          typology: string
        }
        Insert: {
          created_at?: string
          finish: string
          floor_area_m2: number
          id?: string
          item_code: string
          quantity: number
          quantity_basis?: string | null
          structure: string
          typology: string
        }
        Update: {
          created_at?: string
          finish?: string
          floor_area_m2?: number
          id?: string
          item_code?: string
          quantity?: number
          quantity_basis?: string | null
          structure?: string
          typology?: string
        }
        Relationships: []
      }
      contributions: {
        Row: {
          body: string | null
          county: string | null
          created_at: string
          id: string
          kind: string
          quality_score: number | null
          ref: string | null
          reviewer_note: string | null
          reward_points: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          county?: string | null
          created_at?: string
          id?: string
          kind: string
          quality_score?: number | null
          ref?: string | null
          reviewer_note?: string | null
          reward_points?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          county?: string | null
          created_at?: string
          id?: string
          kind?: string
          quality_score?: number | null
          ref?: string | null
          reviewer_note?: string | null
          reward_points?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financing_applications: {
        Row: {
          project_id: string | null
          ai_summary: Json | null
          applicant_id: string
          borrower_email: string | null
          borrower_name: string
          borrower_phone: string | null
          consultation_requested_at: string | null
          created_at: string
          currency: string
          documents: Json
          employment_status: string | null
          id: string
          lender_name: string | null
          monthly_income: number | null
          notes: string | null
          property_address: string | null
          property_id: string | null
          property_value: number | null
          purpose: Database["public"]["Enums"]["financing_purpose"]
          readiness: Json | null
          requested_amount: number
          shared_report_url: string | null
          status: Database["public"]["Enums"]["financing_status"]
          tenure_months: number | null
          updated_at: string
        }
        Insert: {
          project_id?: string | null
          ai_summary?: Json | null
          applicant_id: string
          borrower_email?: string | null
          borrower_name: string
          borrower_phone?: string | null
          consultation_requested_at?: string | null
          created_at?: string
          currency?: string
          documents?: Json
          employment_status?: string | null
          id?: string
          lender_name?: string | null
          monthly_income?: number | null
          notes?: string | null
          property_address?: string | null
          property_id?: string | null
          property_value?: number | null
          purpose?: Database["public"]["Enums"]["financing_purpose"]
          readiness?: Json | null
          requested_amount: number
          shared_report_url?: string | null
          status?: Database["public"]["Enums"]["financing_status"]
          tenure_months?: number | null
          updated_at?: string
        }
        Update: {
          project_id?: string | null
          ai_summary?: Json | null
          applicant_id?: string
          borrower_email?: string | null
          borrower_name?: string
          borrower_phone?: string | null
          consultation_requested_at?: string | null
          created_at?: string
          currency?: string
          documents?: Json
          employment_status?: string | null
          id?: string
          lender_name?: string | null
          monthly_income?: number | null
          notes?: string | null
          property_address?: string | null
          property_id?: string | null
          property_value?: number | null
          purpose?: Database["public"]["Enums"]["financing_purpose"]
          readiness?: Json | null
          requested_amount?: number
          shared_report_url?: string | null
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
      labour_rate: {
        Row: {
          county: string | null
          created_at: string
          id: string
          note: string | null
          observed_date: string
          rate_kes: number
          rate_kes_high: number | null
          source: string | null
          source_url: string | null
          trade: string
          unit: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          id?: string
          note?: string | null
          observed_date: string
          rate_kes: number
          rate_kes_high?: number | null
          source?: string | null
          source_url?: string | null
          trade: string
          unit: string
        }
        Update: {
          county?: string | null
          created_at?: string
          id?: string
          note?: string | null
          observed_date?: string
          rate_kes?: number
          rate_kes_high?: number | null
          source?: string | null
          source_url?: string | null
          trade?: string
          unit?: string
        }
        Relationships: []
      }
      land_price_obs: {
        Row: {
          county: string
          created_at: string
          id: string
          include_in_median: boolean
          lat: number | null
          lng: number | null
          locality: string | null
          observed_date: string
          plot_size_sqft: number
          price_kes: number
          quality_note: string | null
          source_name: string | null
          source_type: string
          source_url: string | null
          sub_county: string | null
          ward: string | null
        }
        Insert: {
          county: string
          created_at?: string
          id?: string
          include_in_median?: boolean
          lat?: number | null
          lng?: number | null
          locality?: string | null
          observed_date: string
          plot_size_sqft: number
          price_kes: number
          quality_note?: string | null
          source_name?: string | null
          source_type: string
          source_url?: string | null
          sub_county?: string | null
          ward?: string | null
        }
        Update: {
          county?: string
          created_at?: string
          id?: string
          include_in_median?: boolean
          lat?: number | null
          lng?: number | null
          locality?: string | null
          observed_date?: string
          plot_size_sqft?: number
          price_kes?: number
          quality_note?: string | null
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          sub_county?: string | null
          ward?: string | null
        }
        Relationships: []
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
      listing_versions: {
        Row: {
          changes: Json
          checklist: Json
          completeness_pct: number
          created_at: string
          description: string | null
          editor_id: string
          id: string
          property_id: string
          title: string
          version: number
        }
        Insert: {
          changes?: Json
          checklist?: Json
          completeness_pct?: number
          created_at?: string
          description?: string | null
          editor_id: string
          id?: string
          property_id: string
          title: string
          version?: number
        }
        Update: {
          changes?: Json
          checklist?: Json
          completeness_pct?: number
          created_at?: string
          description?: string | null
          editor_id?: string
          id?: string
          property_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_versions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      location_intel_slices: {
        Row: {
          confidence: number | null
          created_at: string
          expires_at: string
          id: string
          latitude: number
          location_key: string
          longitude: number
          method: string | null
          parcel_id: string | null
          payload: Json
          provider: string
          reason: string | null
          retrieved_at: string
          slice: string
          status: string
          updated_at: string
          version: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          expires_at: string
          id?: string
          latitude: number
          location_key: string
          longitude: number
          method?: string | null
          parcel_id?: string | null
          payload?: Json
          provider: string
          reason?: string | null
          retrieved_at?: string
          slice: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          latitude?: number
          location_key?: string
          longitude?: number
          method?: string | null
          parcel_id?: string | null
          payload?: Json
          provider?: string
          reason?: string | null
          retrieved_at?: string
          slice?: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      marketplace_commissions: {
        Row: {
          agreement_id: string
          agreement_snapshot: Json
          agreement_version: number
          applied_rate: number | null
          applied_tiers: Json
          base_amount: number
          calc_method: Database["public"]["Enums"]["mkt_fee_method"]
          calculation_id: string
          clawback_amount: number
          created_at: string
          currency: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          refund_adjustment: number
          source_id: string
          state: Database["public"]["Enums"]["mkt_commission_state"]
          tax_amount: number
          transaction_id: string
          updated_at: string
        }
        Insert: {
          agreement_id: string
          agreement_snapshot: Json
          agreement_version: number
          applied_rate?: number | null
          applied_tiers?: Json
          base_amount: number
          calc_method: Database["public"]["Enums"]["mkt_fee_method"]
          calculation_id: string
          clawback_amount?: number
          created_at?: string
          currency: string
          gross_amount: number
          id?: string
          net_amount: number
          notes?: string | null
          refund_adjustment?: number
          source_id: string
          state?: Database["public"]["Enums"]["mkt_commission_state"]
          tax_amount?: number
          transaction_id: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string
          agreement_snapshot?: Json
          agreement_version?: number
          applied_rate?: number | null
          applied_tiers?: Json
          base_amount?: number
          calc_method?: Database["public"]["Enums"]["mkt_fee_method"]
          calculation_id?: string
          clawback_amount?: number
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          refund_adjustment?: number
          source_id?: string
          state?: Database["public"]["Enums"]["mkt_commission_state"]
          tax_amount?: number
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commissions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "marketplace_partner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commissions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "marketplace_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_external_listings: {
        Row: {
          active: boolean
          address: string | null
          amenities: Json
          availability_status: Database["public"]["Enums"]["mkt_availability"]
          bathrooms: number | null
          bedrooms: number | null
          booking_amount: number | null
          canonical_url: string | null
          completion_date: string | null
          county: string | null
          created_at: string
          currency: string
          description: string | null
          developer_name: string | null
          freshness: Database["public"]["Enums"]["mkt_freshness"]
          hero_image_url: string | null
          id: string
          intent: Database["public"]["Enums"]["mkt_listing_intent"]
          latitude: number | null
          listing_category: Database["public"]["Enums"]["mkt_listing_category"]
          locality: string | null
          longitude: number | null
          original_listing_url: string | null
          payment_plan_summary: string | null
          price: number | null
          price_qualifier: string | null
          project_name: string | null
          size_unit: string | null
          size_value: number | null
          source_checked_at: string | null
          source_id: string
          source_listing_id: string
          source_updated_at: string | null
          specifications: Json
          tenure: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["mkt_verification_status"]
        }
        Insert: {
          active?: boolean
          address?: string | null
          amenities?: Json
          availability_status?: Database["public"]["Enums"]["mkt_availability"]
          bathrooms?: number | null
          bedrooms?: number | null
          booking_amount?: number | null
          canonical_url?: string | null
          completion_date?: string | null
          county?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          developer_name?: string | null
          freshness?: Database["public"]["Enums"]["mkt_freshness"]
          hero_image_url?: string | null
          id?: string
          intent?: Database["public"]["Enums"]["mkt_listing_intent"]
          latitude?: number | null
          listing_category?: Database["public"]["Enums"]["mkt_listing_category"]
          locality?: string | null
          longitude?: number | null
          original_listing_url?: string | null
          payment_plan_summary?: string | null
          price?: number | null
          price_qualifier?: string | null
          project_name?: string | null
          size_unit?: string | null
          size_value?: number | null
          source_checked_at?: string | null
          source_id: string
          source_listing_id: string
          source_updated_at?: string | null
          specifications?: Json
          tenure?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["mkt_verification_status"]
        }
        Update: {
          active?: boolean
          address?: string | null
          amenities?: Json
          availability_status?: Database["public"]["Enums"]["mkt_availability"]
          bathrooms?: number | null
          bedrooms?: number | null
          booking_amount?: number | null
          canonical_url?: string | null
          completion_date?: string | null
          county?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          developer_name?: string | null
          freshness?: Database["public"]["Enums"]["mkt_freshness"]
          hero_image_url?: string | null
          id?: string
          intent?: Database["public"]["Enums"]["mkt_listing_intent"]
          latitude?: number | null
          listing_category?: Database["public"]["Enums"]["mkt_listing_category"]
          locality?: string | null
          longitude?: number | null
          original_listing_url?: string | null
          payment_plan_summary?: string | null
          price?: number | null
          price_qualifier?: string | null
          project_name?: string | null
          size_unit?: string | null
          size_value?: number | null
          source_checked_at?: string | null
          source_id?: string
          source_listing_id?: string
          source_updated_at?: string | null
          specifications?: Json
          tenure?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["mkt_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_external_listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_leads: {
        Row: {
          assigned_to: string | null
          consent_marketing: boolean
          consent_marketing_at: string | null
          consent_partner_contact: boolean
          consent_partner_contact_at: string | null
          consent_receipt: Json
          created_at: string
          email: string | null
          enquiry_type: string
          external_listing_id: string | null
          full_name: string
          id: string
          message: string | null
          phone: string | null
          referral_id: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["mkt_lead_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          consent_marketing?: boolean
          consent_marketing_at?: string | null
          consent_partner_contact?: boolean
          consent_partner_contact_at?: string | null
          consent_receipt?: Json
          created_at?: string
          email?: string | null
          enquiry_type?: string
          external_listing_id?: string | null
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          referral_id?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["mkt_lead_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          consent_marketing?: boolean
          consent_marketing_at?: string | null
          consent_partner_contact?: boolean
          consent_partner_contact_at?: string | null
          consent_receipt?: Json
          created_at?: string
          email?: string | null
          enquiry_type?: string
          external_listing_id?: string | null
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          referral_id?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["mkt_lead_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_leads_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_leads_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "marketplace_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listing_price_history: {
        Row: {
          availability_status:
            | Database["public"]["Enums"]["mkt_availability"]
            | null
          booking_amount: number | null
          currency: string | null
          id: string
          listing_id: string
          observed_at: string
          price: number | null
        }
        Insert: {
          availability_status?:
            | Database["public"]["Enums"]["mkt_availability"]
            | null
          booking_amount?: number | null
          currency?: string | null
          id?: string
          listing_id: string
          observed_at?: string
          price?: number | null
        }
        Update: {
          availability_status?:
            | Database["public"]["Enums"]["mkt_availability"]
            | null
          booking_amount?: number | null
          currency?: string | null
          id?: string
          listing_id?: string
          observed_at?: string
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_external_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_partner_agreements: {
        Row: {
          agreement_type: string
          attribution_window_days: number
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          evidence_ref: string | null
          exclusions: Json
          fee_method: Database["public"]["Enums"]["mkt_fee_method"]
          flat_fee: number | null
          id: string
          max_fee: number | null
          min_fee: number | null
          percentage_rate: number | null
          signed_at: string | null
          signed_by: string | null
          source_id: string
          status: Database["public"]["Enums"]["mkt_agreement_status"]
          tax_inclusive: boolean
          tax_rate: number | null
          tiers: Json
          updated_at: string
          version: number
        }
        Insert: {
          agreement_type?: string
          attribution_window_days?: number
          created_at?: string
          currency?: string
          effective_from: string
          effective_to?: string | null
          evidence_ref?: string | null
          exclusions?: Json
          fee_method: Database["public"]["Enums"]["mkt_fee_method"]
          flat_fee?: number | null
          id?: string
          max_fee?: number | null
          min_fee?: number | null
          percentage_rate?: number | null
          signed_at?: string | null
          signed_by?: string | null
          source_id: string
          status?: Database["public"]["Enums"]["mkt_agreement_status"]
          tax_inclusive?: boolean
          tax_rate?: number | null
          tiers?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          agreement_type?: string
          attribution_window_days?: number
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          evidence_ref?: string | null
          exclusions?: Json
          fee_method?: Database["public"]["Enums"]["mkt_fee_method"]
          flat_fee?: number | null
          id?: string
          max_fee?: number | null
          min_fee?: number | null
          percentage_rate?: number | null
          signed_at?: string | null
          signed_by?: string | null
          source_id?: string
          status?: Database["public"]["Enums"]["mkt_agreement_status"]
          tax_inclusive?: boolean
          tax_rate?: number | null
          tiers?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_agreements_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payouts: {
        Row: {
          amount: number
          commission_id: string
          created_at: string
          currency: string
          id: string
          invoice_ref: string | null
          paid_at: string | null
          payment_reference: string | null
          source_id: string
          state: Database["public"]["Enums"]["mkt_payout_state"]
          updated_at: string
        }
        Insert: {
          amount: number
          commission_id: string
          created_at?: string
          currency?: string
          id?: string
          invoice_ref?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          source_id: string
          state?: Database["public"]["Enums"]["mkt_payout_state"]
          updated_at?: string
        }
        Update: {
          amount?: number
          commission_id?: string
          created_at?: string
          currency?: string
          id?: string
          invoice_ref?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          source_id?: string
          state?: Database["public"]["Enums"]["mkt_payout_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payouts_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "marketplace_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payouts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_referral_events: {
        Row: {
          event_type: Database["public"]["Enums"]["mkt_referral_event"]
          external_listing_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          override_by: string | null
          override_reason: string | null
          referral_id: string | null
          source_id: string | null
        }
        Insert: {
          event_type: Database["public"]["Enums"]["mkt_referral_event"]
          external_listing_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          override_by?: string | null
          override_reason?: string | null
          referral_id?: string | null
          source_id?: string | null
        }
        Update: {
          event_type?: Database["public"]["Enums"]["mkt_referral_event"]
          external_listing_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          override_by?: string | null
          override_reason?: string | null
          referral_id?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_referral_events_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_events_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "marketplace_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_referrals: {
        Row: {
          attribution_window_days: number | null
          created_at: string
          expires_at: string | null
          external_listing_id: string | null
          id: string
          property_id: string | null
          referral_code: string
          session_hash: string | null
          source_id: string | null
          user_id: string | null
        }
        Insert: {
          attribution_window_days?: number | null
          created_at?: string
          expires_at?: string | null
          external_listing_id?: string | null
          id?: string
          property_id?: string | null
          referral_code: string
          session_hash?: string | null
          source_id?: string | null
          user_id?: string | null
        }
        Update: {
          attribution_window_days?: number | null
          created_at?: string
          expires_at?: string | null
          external_listing_id?: string | null
          id?: string
          property_id?: string | null
          referral_code?: string
          session_hash?: string | null
          source_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_referrals_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referrals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referrals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_source_members: {
        Row: {
          created_at: string
          id: string
          role: string
          source_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          source_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_source_members_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_source_sync_runs: {
        Row: {
          actor_id: string | null
          archived_count: number
          completed_at: string | null
          created_count: number
          error_count: number
          error_detail: Json
          fetched_count: number
          id: string
          mode: Database["public"]["Enums"]["mkt_integration_mode"]
          ok: boolean
          source_id: string
          started_at: string
          updated_count: number
        }
        Insert: {
          actor_id?: string | null
          archived_count?: number
          completed_at?: string | null
          created_count?: number
          error_count?: number
          error_detail?: Json
          fetched_count?: number
          id?: string
          mode: Database["public"]["Enums"]["mkt_integration_mode"]
          ok?: boolean
          source_id: string
          started_at?: string
          updated_count?: number
        }
        Update: {
          actor_id?: string | null
          archived_count?: number
          completed_at?: string | null
          created_count?: number
          error_count?: number
          error_detail?: Json
          fetched_count?: number
          id?: string
          mode?: Database["public"]["Enums"]["mkt_integration_mode"]
          ok?: boolean
          source_id?: string
          started_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_source_sync_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sources: {
        Row: {
          active: boolean
          can_display_description: boolean
          can_display_floorplans: boolean
          can_display_images: boolean
          can_republish: boolean
          can_store_locally: boolean
          commercial_status: Database["public"]["Enums"]["mkt_commercial_status"]
          created_at: string
          default_referral_rate: number | null
          description: string | null
          id: string
          integration_mode: Database["public"]["Enums"]["mkt_integration_mode"]
          logo_url: string | null
          name: string
          partner_feed: boolean
          rights_basis: string | null
          rights_checked_at: string | null
          rights_expires_at: string | null
          slug: string
          source_type: Database["public"]["Enums"]["mkt_source_type"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          active?: boolean
          can_display_description?: boolean
          can_display_floorplans?: boolean
          can_display_images?: boolean
          can_republish?: boolean
          can_store_locally?: boolean
          commercial_status?: Database["public"]["Enums"]["mkt_commercial_status"]
          created_at?: string
          default_referral_rate?: number | null
          description?: string | null
          id?: string
          integration_mode?: Database["public"]["Enums"]["mkt_integration_mode"]
          logo_url?: string | null
          name: string
          partner_feed?: boolean
          rights_basis?: string | null
          rights_checked_at?: string | null
          rights_expires_at?: string | null
          slug: string
          source_type: Database["public"]["Enums"]["mkt_source_type"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          active?: boolean
          can_display_description?: boolean
          can_display_floorplans?: boolean
          can_display_images?: boolean
          can_republish?: boolean
          can_store_locally?: boolean
          commercial_status?: Database["public"]["Enums"]["mkt_commercial_status"]
          created_at?: string
          default_referral_rate?: number | null
          description?: string | null
          id?: string
          integration_mode?: Database["public"]["Enums"]["mkt_integration_mode"]
          logo_url?: string | null
          name?: string
          partner_feed?: boolean
          rights_basis?: string | null
          rights_checked_at?: string | null
          rights_expires_at?: string | null
          slug?: string
          source_type?: Database["public"]["Enums"]["mkt_source_type"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      marketplace_transactions: {
        Row: {
          close_evidence: Json
          closed_at: string | null
          created_at: string
          currency: string
          external_listing_id: string | null
          id: string
          idempotency_key: string
          lead_id: string | null
          referral_id: string | null
          refunded_amount: number
          source_id: string
          status: Database["public"]["Enums"]["mkt_transaction_status"]
          transaction_value: number
          updated_at: string
        }
        Insert: {
          close_evidence?: Json
          closed_at?: string | null
          created_at?: string
          currency?: string
          external_listing_id?: string | null
          id?: string
          idempotency_key: string
          lead_id?: string | null
          referral_id?: string | null
          refunded_amount?: number
          source_id: string
          status?: Database["public"]["Enums"]["mkt_transaction_status"]
          transaction_value: number
          updated_at?: string
        }
        Update: {
          close_evidence?: Json
          closed_at?: string | null
          created_at?: string
          currency?: string
          external_listing_id?: string | null
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          referral_id?: string | null
          refunded_amount?: number
          source_id?: string
          status?: Database["public"]["Enums"]["mkt_transaction_status"]
          transaction_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transactions_external_listing_id_fkey"
            columns: ["external_listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_external_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketplace_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "marketplace_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_verification_evidence: {
        Row: {
          authority: string
          created_at: string
          evidence_type: string
          id: string
          listing_id: string
          metadata: Json
          method: string
          record_class: Database["public"]["Enums"]["mkt_evidence_class"]
          recorded_by: string | null
          retrieved_at: string
          source_record_id: string | null
          source_record_url: string | null
        }
        Insert: {
          authority: string
          created_at?: string
          evidence_type: string
          id?: string
          listing_id: string
          metadata?: Json
          method: string
          record_class: Database["public"]["Enums"]["mkt_evidence_class"]
          recorded_by?: string | null
          retrieved_at?: string
          source_record_id?: string | null
          source_record_url?: string | null
        }
        Update: {
          authority?: string
          created_at?: string
          evidence_type?: string
          id?: string
          listing_id?: string
          metadata?: Json
          method?: string
          record_class?: Database["public"]["Enums"]["mkt_evidence_class"]
          recorded_by?: string | null
          retrieved_at?: string
          source_record_id?: string | null
          source_record_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_verification_evidence_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_external_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      material_price: {
        Row: {
          category: string | null
          county: string | null
          created_at: string
          id: string
          item_code: string
          name: string
          note: string | null
          observed_date: string
          price_kes: number
          price_kes_high: number | null
          price_kes_low: number | null
          source_type: string
          source_url: string | null
          supplier: string | null
          unit: string
          use_in_totals: boolean
        }
        Insert: {
          category?: string | null
          county?: string | null
          created_at?: string
          id?: string
          item_code: string
          name: string
          note?: string | null
          observed_date: string
          price_kes: number
          price_kes_high?: number | null
          price_kes_low?: number | null
          source_type: string
          source_url?: string | null
          supplier?: string | null
          unit: string
          use_in_totals?: boolean
        }
        Update: {
          category?: string | null
          county?: string | null
          created_at?: string
          id?: string
          item_code?: string
          name?: string
          note?: string | null
          observed_date?: string
          price_kes?: number
          price_kes_high?: number | null
          price_kes_low?: number | null
          source_type?: string
          source_url?: string | null
          supplier?: string | null
          unit?: string
          use_in_totals?: boolean
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          ai_processed: boolean
          archived: boolean
          author: string | null
          category: string
          cluster_id: string | null
          confidence: number
          county: string | null
          created_at: string
          environmental_impact: string | null
          external_id: string | null
          geo_level: Database["public"]["Enums"]["news_geo_level"]
          id: string
          image_url: string | null
          infrastructure_impact: string | null
          ingested_at: string
          investment_impact: string | null
          land_impact: string | null
          language: string
          latitude: number | null
          longitude: number | null
          place_label: string | null
          property_impact: string | null
          provider: Database["public"]["Enums"]["news_provider"]
          published_at: string | null
          raw_excerpt: string | null
          save_count: number
          share_count: number
          source_id: string | null
          source_logo_url: string | null
          source_name: string | null
          summary: string | null
          tags: string[]
          title: string
          title_normalized: string
          updated_at: string
          url: string
          url_hash: string
          view_count: number
          why_it_matters: string | null
        }
        Insert: {
          ai_processed?: boolean
          archived?: boolean
          author?: string | null
          category?: string
          cluster_id?: string | null
          confidence?: number
          county?: string | null
          created_at?: string
          environmental_impact?: string | null
          external_id?: string | null
          geo_level?: Database["public"]["Enums"]["news_geo_level"]
          id?: string
          image_url?: string | null
          infrastructure_impact?: string | null
          ingested_at?: string
          investment_impact?: string | null
          land_impact?: string | null
          language?: string
          latitude?: number | null
          longitude?: number | null
          place_label?: string | null
          property_impact?: string | null
          provider: Database["public"]["Enums"]["news_provider"]
          published_at?: string | null
          raw_excerpt?: string | null
          save_count?: number
          share_count?: number
          source_id?: string | null
          source_logo_url?: string | null
          source_name?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          title_normalized: string
          updated_at?: string
          url: string
          url_hash: string
          view_count?: number
          why_it_matters?: string | null
        }
        Update: {
          ai_processed?: boolean
          archived?: boolean
          author?: string | null
          category?: string
          cluster_id?: string | null
          confidence?: number
          county?: string | null
          created_at?: string
          environmental_impact?: string | null
          external_id?: string | null
          geo_level?: Database["public"]["Enums"]["news_geo_level"]
          id?: string
          image_url?: string | null
          infrastructure_impact?: string | null
          ingested_at?: string
          investment_impact?: string | null
          land_impact?: string | null
          language?: string
          latitude?: number | null
          longitude?: number | null
          place_label?: string | null
          property_impact?: string | null
          provider?: Database["public"]["Enums"]["news_provider"]
          published_at?: string | null
          raw_excerpt?: string | null
          save_count?: number
          share_count?: number
          source_id?: string | null
          source_logo_url?: string | null
          source_name?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          title_normalized?: string
          updated_at?: string
          url?: string
          url_hash?: string
          view_count?: number
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "news_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "news_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      news_audio: {
        Row: {
          article_id: string
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          engine: string
          id: string
          script: string
          segment: string
          voice: string | null
        }
        Insert: {
          article_id: string
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          engine?: string
          id?: string
          script: string
          segment?: string
          voice?: string | null
        }
        Update: {
          article_id?: string
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          engine?: string
          id?: string
          script?: string
          segment?: string
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_audio_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      news_clusters: {
        Row: {
          article_count: number
          category: string | null
          county: string | null
          created_at: string
          id: string
          key: string
          last_article_at: string | null
          source_count: number
          title: string
          updated_at: string
        }
        Insert: {
          article_count?: number
          category?: string | null
          county?: string | null
          created_at?: string
          id?: string
          key: string
          last_article_at?: string | null
          source_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          article_count?: number
          category?: string | null
          county?: string | null
          created_at?: string
          id?: string
          key?: string
          last_article_at?: string | null
          source_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_ingestion_logs: {
        Row: {
          created_at: string
          duplicate_count: number
          error_message: string | null
          failed_count: number
          fetched_count: number
          finished_at: string | null
          id: string
          inserted_count: number
          ok: boolean
          provider: Database["public"]["Enums"]["news_provider"]
          rejected_count: number
          source_id: string | null
          started_at: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          error_message?: string | null
          failed_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          ok?: boolean
          provider: Database["public"]["Enums"]["news_provider"]
          rejected_count?: number
          source_id?: string | null
          started_at?: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          error_message?: string | null
          failed_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          ok?: boolean
          provider?: Database["public"]["Enums"]["news_provider"]
          rejected_count?: number
          source_id?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_ingestion_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "news_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      news_locations: {
        Row: {
          article_id: string
          confidence: number
          county: string | null
          created_at: string
          geo_level: Database["public"]["Enums"]["news_geo_level"]
          id: string
          label: string
          latitude: number | null
          longitude: number | null
        }
        Insert: {
          article_id: string
          confidence?: number
          county?: string | null
          created_at?: string
          geo_level?: Database["public"]["Enums"]["news_geo_level"]
          id?: string
          label: string
          latitude?: number | null
          longitude?: number | null
        }
        Update: {
          article_id?: string
          confidence?: number
          county?: string | null
          created_at?: string
          geo_level?: Database["public"]["Enums"]["news_geo_level"]
          id?: string
          label?: string
          latitude?: number | null
          longitude?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "news_locations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_provider_health: {
        Row: {
          last_error: string | null
          last_error_at: string | null
          last_ok_at: string | null
          latency_ms: number | null
          provider: Database["public"]["Enums"]["news_provider"]
          quota_note: string | null
          requests_today: number
          status: Database["public"]["Enums"]["news_provider_status"]
          updated_at: string
        }
        Insert: {
          last_error?: string | null
          last_error_at?: string | null
          last_ok_at?: string | null
          latency_ms?: number | null
          provider: Database["public"]["Enums"]["news_provider"]
          quota_note?: string | null
          requests_today?: number
          status?: Database["public"]["Enums"]["news_provider_status"]
          updated_at?: string
        }
        Update: {
          last_error?: string | null
          last_error_at?: string | null
          last_ok_at?: string | null
          latency_ms?: number | null
          provider?: Database["public"]["Enums"]["news_provider"]
          quota_note?: string | null
          requests_today?: number
          status?: Database["public"]["Enums"]["news_provider_status"]
          updated_at?: string
        }
        Relationships: []
      }
      news_sources: {
        Row: {
          category_hint: string | null
          county: string | null
          created_at: string
          feed_url: string | null
          homepage_url: string | null
          id: string
          last_fetched_at: string | null
          logo_url: string | null
          name: string
          provider: Database["public"]["Enums"]["news_provider"]
          refresh_minutes: number
          slug: string
          status: Database["public"]["Enums"]["news_provider_status"]
          updated_at: string
        }
        Insert: {
          category_hint?: string | null
          county?: string | null
          created_at?: string
          feed_url?: string | null
          homepage_url?: string | null
          id?: string
          last_fetched_at?: string | null
          logo_url?: string | null
          name: string
          provider: Database["public"]["Enums"]["news_provider"]
          refresh_minutes?: number
          slug: string
          status?: Database["public"]["Enums"]["news_provider_status"]
          updated_at?: string
        }
        Update: {
          category_hint?: string | null
          county?: string | null
          created_at?: string
          feed_url?: string | null
          homepage_url?: string | null
          id?: string
          last_fetched_at?: string | null
          logo_url?: string | null
          name?: string
          provider?: Database["public"]["Enums"]["news_provider"]
          refresh_minutes?: number
          slug?: string
          status?: Database["public"]["Enums"]["news_provider_status"]
          updated_at?: string
        }
        Relationships: []
      }
      news_tags: {
        Row: {
          created_at: string
          id: string
          label: string
          slug: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          slug: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          slug?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      parcel_beacons: {
        Row: {
          beacon_code: string
          elevation_m: number | null
          id: string
          lat: number
          lng: number
          ordinal: number
          parcel_id: string
        }
        Insert: {
          beacon_code: string
          elevation_m?: number | null
          id?: string
          lat: number
          lng: number
          ordinal?: number
          parcel_id: string
        }
        Update: {
          beacon_code?: string
          elevation_m?: number | null
          id?: string
          lat?: number
          lng?: number
          ordinal?: number
          parcel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcel_beacons_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_verification_events: {
        Row: {
          actor_id: string | null
          created_at: string
          evidence_ref: string | null
          from_state: string | null
          id: string
          method: string | null
          note: string | null
          parcel_id: string
          to_state: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          evidence_ref?: string | null
          from_state?: string | null
          id?: string
          method?: string | null
          note?: string | null
          parcel_id: string
          to_state: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          evidence_ref?: string | null
          from_state?: string | null
          id?: string
          method?: string | null
          note?: string | null
          parcel_id?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcel_verification_events_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          project_id: string | null
          area_sqm: number
          centroid_lat: number
          centroid_lng: number
          county: string | null
          created_at: string
          deed_hash: string | null
          elevation_masl: number | null
          geometry: Json
          id: string
          is_sample: boolean
          legacy_parcel_code: string | null
          legacy_title_deed_no: string | null
          max_building_height_m: number | null
          owner_id: string | null
          parcel_code: string
          riparian_setback_m: number | null
          road_setback_m: number | null
          status: string | null
          survey_verified_on: string | null
          title_deed_no: string
          valuation_kes: number | null
          verification_confidence: number
          verification_evidence_ref: string | null
          verification_method: string | null
          verification_state: string
          verification_updated_at: string | null
          zoning_type: string | null
        }
        Insert: {
          project_id?: string | null
          area_sqm: number
          centroid_lat: number
          centroid_lng: number
          county?: string | null
          created_at?: string
          deed_hash?: string | null
          elevation_masl?: number | null
          geometry: Json
          id?: string
          is_sample?: boolean
          legacy_parcel_code?: string | null
          legacy_title_deed_no?: string | null
          max_building_height_m?: number | null
          owner_id?: string | null
          parcel_code: string
          riparian_setback_m?: number | null
          road_setback_m?: number | null
          status?: string | null
          survey_verified_on?: string | null
          title_deed_no: string
          valuation_kes?: number | null
          verification_confidence?: number
          verification_evidence_ref?: string | null
          verification_method?: string | null
          verification_state?: string
          verification_updated_at?: string | null
          zoning_type?: string | null
        }
        Update: {
          project_id?: string | null
          area_sqm?: number
          centroid_lat?: number
          centroid_lng?: number
          county?: string | null
          created_at?: string
          deed_hash?: string | null
          elevation_masl?: number | null
          geometry?: Json
          id?: string
          is_sample?: boolean
          legacy_parcel_code?: string | null
          legacy_title_deed_no?: string | null
          max_building_height_m?: number | null
          owner_id?: string | null
          parcel_code?: string
          riparian_setback_m?: number | null
          road_setback_m?: number | null
          status?: string | null
          survey_verified_on?: string | null
          title_deed_no?: string
          valuation_kes?: number | null
          verification_confidence?: number
          verification_evidence_ref?: string | null
          verification_method?: string | null
          verification_state?: string
          verification_updated_at?: string | null
          zoning_type?: string | null
        }
        Relationships: []
      }
      professional_profiles: {
        Row: {
          availability: string | null
          availability_slots: Json
          bio: string | null
          category: Database["public"]["Enums"]["pro_category"]
          contact_email: string | null
          contact_phone: string | null
          county: string | null
          created_at: string
          display_name: string
          id: string
          organisation: string | null
          portfolio: Json
          published: boolean
          qualifications: string[]
          rate_note: string | null
          registration_body: string | null
          registration_number: string | null
          service_counties: string[]
          town: string | null
          updated_at: string
          user_id: string
          verification_evidence: Json
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["pro_verification"]
          verification_submitted_at: string | null
          verified_at: string | null
          website: string | null
          years_experience: number | null
        }
        Insert: {
          availability?: string | null
          availability_slots?: Json
          bio?: string | null
          category: Database["public"]["Enums"]["pro_category"]
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          display_name: string
          id?: string
          organisation?: string | null
          portfolio?: Json
          published?: boolean
          qualifications?: string[]
          rate_note?: string | null
          registration_body?: string | null
          registration_number?: string | null
          service_counties?: string[]
          town?: string | null
          updated_at?: string
          user_id: string
          verification_evidence?: Json
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["pro_verification"]
          verification_submitted_at?: string | null
          verified_at?: string | null
          website?: string | null
          years_experience?: number | null
        }
        Update: {
          availability?: string | null
          availability_slots?: Json
          bio?: string | null
          category?: Database["public"]["Enums"]["pro_category"]
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          display_name?: string
          id?: string
          organisation?: string | null
          portfolio?: Json
          published?: boolean
          qualifications?: string[]
          rate_note?: string | null
          registration_body?: string | null
          registration_number?: string | null
          service_counties?: string[]
          town?: string | null
          updated_at?: string
          user_id?: string
          verification_evidence?: Json
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["pro_verification"]
          verification_submitted_at?: string | null
          verified_at?: string | null
          website?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      professional_requests: {
        Row: {
          budget_note: string | null
          confirmed_end: string | null
          confirmed_start: string | null
          contact_email: string | null
          contact_phone: string | null
          county: string | null
          created_at: string
          id: string
          preferred_end: string | null
          preferred_start: string | null
          professional_id: string
          project_brief: string
          property_id: string | null
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          budget_note?: string | null
          confirmed_end?: string | null
          confirmed_start?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          id?: string
          preferred_end?: string | null
          preferred_start?: string | null
          professional_id: string
          project_brief: string
          property_id?: string | null
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          budget_note?: string | null
          confirmed_end?: string | null
          confirmed_start?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          id?: string
          preferred_end?: string | null
          preferred_start?: string | null
          professional_id?: string
          project_brief?: string
          property_id?: string | null
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          professional_id: string
          rating: number
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          professional_id: string
          rating: number
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          professional_id?: string
          rating?: number
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alert_email: boolean
          alert_in_app: boolean
          avatar_url: string | null
          county: string | null
          created_at: string
          display_name: string | null
          headline: string | null
          id: string
          news_topics: string[]
          phone: string | null
          updated_at: string
        }
        Insert: {
          alert_email?: boolean
          alert_in_app?: boolean
          avatar_url?: string | null
          county?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          id: string
          news_topics?: string[]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          alert_email?: boolean
          alert_in_app?: boolean
          avatar_url?: string | null
          county?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          id?: string
          news_topics?: string[]
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          added_by: string | null
          created_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          boundary: Json | null
          county: string | null
          created_at: string
          id: string
          latitude: number | null
          location_key: string | null
          longitude: number | null
          name: string
          notes: string | null
          owner_id: string
          parcel_id: string | null
          property_id: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          boundary?: Json | null
          county?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location_key?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          owner_id?: string
          parcel_id?: string | null
          property_id?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          boundary?: Json | null
          county?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          location_key?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          owner_id?: string
          parcel_id?: string | null
          property_id?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          project_id: string | null
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
          development_concept: Json | null
          featured: boolean
          id: string
          intent: Database["public"]["Enums"]["listing_intent"]
          investment_readiness: Json | null
          is_sample: boolean
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
          project_id?: string | null
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
          development_concept?: Json | null
          featured?: boolean
          id?: string
          intent?: Database["public"]["Enums"]["listing_intent"]
          investment_readiness?: Json | null
          is_sample?: boolean
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
          project_id?: string | null
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
          development_concept?: Json | null
          featured?: boolean
          id?: string
          intent?: Database["public"]["Enums"]["listing_intent"]
          investment_readiness?: Json | null
          is_sample?: boolean
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
          availability_windows: Json
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
          viewing_windows: Json
        }
        Insert: {
          accessibility_features?: string[]
          availability_windows?: Json
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
          viewing_windows?: Json
        }
        Update: {
          accessibility_features?: string[]
          availability_windows?: Json
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
          viewing_windows?: Json
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
          commute_origin_label: string | null
          commute_origin_lat: number | null
          commute_origin_lng: number | null
          commute_preference: string | null
          counties: string[]
          created_at: string
          max_commute_minutes: number | null
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
          commute_origin_label?: string | null
          commute_origin_lat?: number | null
          commute_origin_lng?: number | null
          commute_preference?: string | null
          counties?: string[]
          created_at?: string
          max_commute_minutes?: number | null
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
          commute_origin_label?: string | null
          commute_origin_lat?: number | null
          commute_origin_lng?: number | null
          commute_preference?: string | null
          counties?: string[]
          created_at?: string
          max_commute_minutes?: number | null
          personalization_enabled?: boolean
          schools_priority?: number
          security_priority?: number
          towns?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          saved_item_id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          saved_item_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          saved_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "report_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_collection_items_saved_item_id_fkey"
            columns: ["saved_item_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      report_collections: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_shares: {
        Row: {
          created_at: string
          deed_ref: string | null
          expires_at: string | null
          id: string
          label: string
          last_accessed_at: string | null
          latitude: number | null
          longitude: number | null
          note: string | null
          owner_id: string
          recipient_email: string
          revoked_at: string | null
          saved_item_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deed_ref?: string | null
          expires_at?: string | null
          id?: string
          label: string
          last_accessed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          owner_id: string
          recipient_email: string
          revoked_at?: string | null
          saved_item_id: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deed_ref?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          last_accessed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          owner_id?: string
          recipient_email?: string
          revoked_at?: string | null
          saved_item_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_shares_saved_item_id_fkey"
            columns: ["saved_item_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          changes: Json
          created_at: string
          id: string
          owner_id: string
          saved_item_id: string
          snapshot: Json
          summary: string
          version: number
        }
        Insert: {
          changes?: Json
          created_at?: string
          id?: string
          owner_id: string
          saved_item_id: string
          snapshot?: Json
          summary: string
          version: number
        }
        Update: {
          changes?: Json
          created_at?: string
          id?: string
          owner_id?: string
          saved_item_id?: string
          snapshot?: Json
          summary?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_saved_item_id_fkey"
            columns: ["saved_item_id"]
            isOneToOne: false
            referencedRelation: "saved_items"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_assessments: {
        Row: {
          assessment_key: string
          confidence_pct: number | null
          coverage: number | null
          domain: string
          generated_at: string
          generated_by: string
          id: string
          metadata: Json
          methodology: string
          methodology_version: string
          missing_evidence: Json
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          state: string
          subject_ref: string
          subject_type: string
        }
        Insert: {
          assessment_key: string
          confidence_pct?: number | null
          coverage?: number | null
          domain: string
          generated_at?: string
          generated_by: string
          id?: string
          metadata?: Json
          methodology: string
          methodology_version: string
          missing_evidence?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          state?: string
          subject_ref: string
          subject_type: string
        }
        Update: {
          assessment_key?: string
          confidence_pct?: number | null
          coverage?: number | null
          domain?: string
          generated_at?: string
          generated_by?: string
          id?: string
          metadata?: Json
          methodology?: string
          methodology_version?: string
          missing_evidence?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          state?: string
          subject_ref?: string
          subject_type?: string
        }
        Relationships: []
      }
      resource_evidence_links: {
        Row: {
          assessment_ref: string
          created_at: string
          id: string
          observation_id: string
          role: string
          weight: number
        }
        Insert: {
          assessment_ref: string
          created_at?: string
          id?: string
          observation_id: string
          role: string
          weight?: number
        }
        Update: {
          assessment_ref?: string
          created_at?: string
          id?: string
          observation_id?: string
          role?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_evidence_links_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "resource_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_observations: {
        Row: {
          algorithm_version: string | null
          confidence_pct: number | null
          created_at: string
          domain: string
          epistemic_tier: string
          id: string
          indicator: string
          metadata: Json
          methodology: string
          model_version: string | null
          observed_at: string | null
          parcel_id: string | null
          provenance_hash: string
          retrieved_at: string
          source_id: string
          source_record_id: string | null
          spatial_resolution: string | null
          subject_ref: string
          subject_type: string
          temporal_resolution: string | null
          unit: string | null
          valid_from: string | null
          valid_to: string | null
          value_json: Json
          verification_state: string
        }
        Insert: {
          algorithm_version?: string | null
          confidence_pct?: number | null
          created_at?: string
          domain: string
          epistemic_tier?: string
          id?: string
          indicator: string
          metadata?: Json
          methodology: string
          model_version?: string | null
          observed_at?: string | null
          parcel_id?: string | null
          provenance_hash: string
          retrieved_at?: string
          source_id: string
          source_record_id?: string | null
          spatial_resolution?: string | null
          subject_ref: string
          subject_type: string
          temporal_resolution?: string | null
          unit?: string | null
          valid_from?: string | null
          valid_to?: string | null
          value_json?: Json
          verification_state?: string
        }
        Update: {
          algorithm_version?: string | null
          confidence_pct?: number | null
          created_at?: string
          domain?: string
          epistemic_tier?: string
          id?: string
          indicator?: string
          metadata?: Json
          methodology?: string
          model_version?: string | null
          observed_at?: string | null
          parcel_id?: string | null
          provenance_hash?: string
          retrieved_at?: string
          source_id?: string
          source_record_id?: string | null
          spatial_resolution?: string | null
          subject_ref?: string
          subject_type?: string
          temporal_resolution?: string | null
          unit?: string | null
          valid_from?: string | null
          valid_to?: string | null
          value_json?: Json
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_observations_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_observations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "resource_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_sources: {
        Row: {
          active: boolean
          approved_method: string
          authority: string
          created_at: string
          id: string
          licence: string | null
          source_class: string
          source_system: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          approved_method: string
          authority: string
          created_at?: string
          id?: string
          licence?: string | null
          source_class: string
          source_system: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          approved_method?: string
          authority?: string
          created_at?: string
          id?: string
          licence?: string | null
          source_class?: string
          source_system?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_articles: {
        Row: {
          article_id: string
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
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
      scout_evidence: {
        Row: {
          accuracy_m: number | null
          captured_at: string
          created_at: string
          evidence_kind: string
          id: string
          interview_consent: boolean
          lat: number | null
          lng: number | null
          location_source: string
          mime_type: string | null
          note: string | null
          request_id: string
          scout_id: string
          size_bytes: number | null
          storage_path: string | null
          task_code: string
        }
        Insert: {
          accuracy_m?: number | null
          captured_at?: string
          created_at?: string
          evidence_kind: string
          id?: string
          interview_consent?: boolean
          lat?: number | null
          lng?: number | null
          location_source?: string
          mime_type?: string | null
          note?: string | null
          request_id: string
          scout_id: string
          size_bytes?: number | null
          storage_path?: string | null
          task_code: string
        }
        Update: {
          accuracy_m?: number | null
          captured_at?: string
          created_at?: string
          evidence_kind?: string
          id?: string
          interview_consent?: boolean
          lat?: number | null
          lng?: number | null
          location_source?: string
          mime_type?: string | null
          note?: string | null
          request_id?: string
          scout_id?: string
          size_bytes?: number | null
          storage_path?: string | null
          task_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_evidence_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "scout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_payment_receipts: {
        Row: {
          amount_kes: number
          created_at: string
          reference: string
          request_id: string
          verified_by: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          reference: string
          request_id: string
          verified_by: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          reference?: string
          request_id?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_payment_receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "scout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_price_catalog: {
        Row: {
          active: boolean
          amount_kes: number
          code: string
          description: string | null
          kind: string
          label: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_kes: number
          code: string
          description?: string | null
          kind: string
          label: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_kes?: number
          code?: string
          description?: string | null
          kind?: string
          label?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      scout_profiles: {
        Row: {
          availability: string | null
          bio: string | null
          created_at: string
          display_name: string
          reviewer_note: string | null
          service_counties: string[]
          status: Database["public"]["Enums"]["scout_profile_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          reviewer_note?: string | null
          service_counties?: string[]
          status?: Database["public"]["Enums"]["scout_profile_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          reviewer_note?: string | null
          service_counties?: string[]
          status?: Database["public"]["Enums"]["scout_profile_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scout_request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: Json | null
          event: string
          id: number
          request_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          event: string
          id?: never
          request_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          event?: string
          id?: never
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "scout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_requests: {
        Row: {
          access_level: string
          block_reason: string | null
          buyer_id: string
          checklist: Json
          claimed_at: string | null
          completed_at: string | null
          conflict_disclosure: string | null
          county: string | null
          created_at: string
          custom_concern: string | null
          evidence_exception_approved: boolean
          evidence_exception_requested: string | null
          id: string
          instructions: string | null
          lat: number | null
          lng: number | null
          location_confirmed_by_buyer: boolean
          location_source: string
          paid_amount_kes: number
          payment_reference: string | null
          payment_submitted_at: string | null
          payment_verified_at: string | null
          payment_verified_by: string | null
          payout_paid_at: string | null
          payout_reference: string | null
          payout_status: Database["public"]["Enums"]["scout_payout_status"]
          pending_quote: Json | null
          quote: Json
          quote_accepted_at: string | null
          quote_version: number
          refund_amount_kes: number
          refund_reference: string | null
          refund_status: string
          reviewed_by: string | null
          reviewer_note: string | null
          scout_id: string | null
          scout_summary: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["scout_request_status"]
          submitted_at: string | null
          task_results: Json
          title_reference: string | null
          travel_estimate_kes: number
          updated_at: string
        }
        Insert: {
          access_level?: string
          block_reason?: string | null
          buyer_id: string
          checklist?: Json
          claimed_at?: string | null
          completed_at?: string | null
          conflict_disclosure?: string | null
          county?: string | null
          created_at?: string
          custom_concern?: string | null
          evidence_exception_approved?: boolean
          evidence_exception_requested?: string | null
          id?: string
          instructions?: string | null
          lat?: number | null
          lng?: number | null
          location_confirmed_by_buyer?: boolean
          location_source: string
          paid_amount_kes?: number
          payment_reference?: string | null
          payment_submitted_at?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          payout_paid_at?: string | null
          payout_reference?: string | null
          payout_status?: Database["public"]["Enums"]["scout_payout_status"]
          pending_quote?: Json | null
          quote: Json
          quote_accepted_at?: string | null
          quote_version?: number
          refund_amount_kes?: number
          refund_reference?: string | null
          refund_status?: string
          reviewed_by?: string | null
          reviewer_note?: string | null
          scout_id?: string | null
          scout_summary?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["scout_request_status"]
          submitted_at?: string | null
          task_results?: Json
          title_reference?: string | null
          travel_estimate_kes?: number
          updated_at?: string
        }
        Update: {
          access_level?: string
          block_reason?: string | null
          buyer_id?: string
          checklist?: Json
          claimed_at?: string | null
          completed_at?: string | null
          conflict_disclosure?: string | null
          county?: string | null
          created_at?: string
          custom_concern?: string | null
          evidence_exception_approved?: boolean
          evidence_exception_requested?: string | null
          id?: string
          instructions?: string | null
          lat?: number | null
          lng?: number | null
          location_confirmed_by_buyer?: boolean
          location_source?: string
          paid_amount_kes?: number
          payment_reference?: string | null
          payment_submitted_at?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          payout_paid_at?: string | null
          payout_reference?: string | null
          payout_status?: Database["public"]["Enums"]["scout_payout_status"]
          pending_quote?: Json | null
          quote?: Json
          quote_accepted_at?: string | null
          quote_version?: number
          refund_amount_kes?: number
          refund_reference?: string | null
          refund_status?: string
          reviewed_by?: string | null
          reviewer_note?: string | null
          scout_id?: string | null
          scout_summary?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["scout_request_status"]
          submitted_at?: string | null
          task_results?: Json
          title_reference?: string | null
          travel_estimate_kes?: number
          updated_at?: string
        }
        Relationships: []
      }
      scout_service_settings: {
        Row: {
          id: boolean
          payment_instructions: string
          payments_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          payment_instructions?: string
          payments_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          payment_instructions?: string
          payments_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      trending_scores: {
        Row: {
          ai_importance: number
          article_id: string
          computed_at: string
          engagement: number
          freshness: number
          score: number
          source_spread: number
        }
        Insert: {
          ai_importance?: number
          article_id: string
          computed_at?: string
          engagement?: number
          freshness?: number
          score?: number
          source_spread?: number
        }
        Update: {
          ai_importance?: number
          article_id?: string
          computed_at?: string
          engagement?: number
          freshness?: number
          score?: number
          source_spread?: number
        }
        Relationships: [
          {
            foreignKeyName: "trending_scores_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_document_shares: {
        Row: {
          created_at: string
          document_id: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          organisation: string | null
          owner_id: string
          party_email: string
          party_name: string
          purpose: string | null
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          organisation?: string | null
          owner_id: string
          party_email: string
          party_name: string
          purpose?: string | null
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          organisation?: string | null
          owner_id?: string
          party_email?: string
          party_name?: string
          purpose?: string | null
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vault_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_documents: {
        Row: {
          category: string
          created_at: string
          file_name: string | null
          financing_application_id: string | null
          id: string
          label: string
          mime_type: string | null
          notes: string | null
          owner_id: string
          property_id: string | null
          size_bytes: number | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name?: string | null
          financing_application_id?: string | null
          id?: string
          label: string
          mime_type?: string | null
          notes?: string | null
          owner_id: string
          property_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string | null
          financing_application_id?: string | null
          id?: string
          label?: string
          mime_type?: string | null
          notes?: string | null
          owner_id?: string
          property_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_documents_financing_application_id_fkey"
            columns: ["financing_application_id"]
            isOneToOne: false
            referencedRelation: "financing_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_slots: {
        Row: {
          capacity: number
          created_at: string
          end_at: string
          id: string
          note: string | null
          owner_id: string
          property_id: string
          start_at: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          end_at: string
          id?: string
          note?: string | null
          owner_id: string
          property_id: string
          start_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          end_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          property_id?: string
          start_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_slots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
          slot_id: string | null
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
          slot_id?: string | null
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
          slot_id?: string | null
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
          {
            foreignKeyName: "viewings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "viewing_slots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      halisia_account_active: { Args: never; Returns: boolean }
      halisia_admin_action: {
        Args: {
          p_action: string
          p_reason: string
          p_target: string
          p_value: string
        }
        Returns: Json
      }
      halisia_admin_overview: { Args: never; Returns: Json }
      halisia_admin_read: {
        Args: { p_offset?: number; p_table: string; p_user?: string }
        Returns: Json
      }
      halisia_admin_status: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_article_view: {
        Args: { _article_id: string }
        Returns: undefined
      }
      is_approved_scout: { Args: { _uid: string }; Returns: boolean }
      is_privileged_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_project_editor: { Args: { _project_id: string }; Returns: boolean }
      is_project_member: { Args: { _project_id: string }; Returns: boolean }
      is_scout_request_participant: { Args: { _req: string }; Returns: boolean }
      is_source_member: { Args: { _source_id: string }; Returns: boolean }
      is_verified_surveyor: { Args: { _user_id: string }; Returns: boolean }
      listing_save_count: { Args: { p_property_id: string }; Returns: number }
      mkt_create_lead: {
        Args: {
          p_consent_marketing?: boolean
          p_consent_partner_contact: boolean
          p_email?: string
          p_enquiry_type?: string
          p_external_listing_id?: string
          p_full_name: string
          p_message?: string
          p_phone?: string
          p_referral_id?: string
        }
        Returns: string
      }
      mkt_create_referral: {
        Args: {
          p_external_listing_id?: string
          p_property_id?: string
          p_source_id?: string
        }
        Returns: {
          expires_at: string
          id: string
          referral_code: string
        }[]
      }
      my_reviewed_scout_findings: {
        Args: { p_reference: string }
        Returns: {
          completed_at: string
          request_id: string
          reviewer_note: string
          scout_summary: string
          task_results: Json
        }[]
      }
      pulse_provider_status: {
        Args: never
        Returns: {
          last_error_at: string
          last_ok_at: string
          latency_ms: number
          provider: string
          requests_today: number
          status: string
        }[]
      }
      scout_compute_quote: {
        Args: {
          p_access_level: string
          p_checklist: Json
          p_travel_kes: number
        }
        Returns: Json
      }
      scout_compute_quote_internal: {
        Args: {
          p_access_level: string
          p_checklist: Json
          p_travel_kes: number
        }
        Returns: Json
      }
      scout_create_request: {
        Args: {
          p_access_level: string
          p_checklist: Json
          p_county: string
          p_custom_concern: string
          p_instructions: string
          p_lat: number
          p_lng: number
          p_location_confirmed: boolean
          p_location_source: string
          p_title_reference: string
          p_travel_kes: number
        }
        Returns: string
      }
      scout_log: {
        Args: { p_detail?: Json; p_event: string; p_req: string }
        Returns: undefined
      }
      scout_serves_county: {
        Args: { _county: string; _uid: string }
        Returns: boolean
      }
      scout_transition: {
        Args: { p_action: string; p_id: string; p_payload?: Json }
        Returns: Database["public"]["Enums"]["scout_request_status"]
      }
      scout_transition_internal: {
        Args: { p_action: string; p_id: string; p_payload?: Json }
        Returns: Database["public"]["Enums"]["scout_request_status"]
      }
    }
    Enums: {
      app_role:
        | "explorer"
        | "buyer"
        | "tenant"
        | "landowner"
        | "seller"
        | "land_agent"
        | "property_company"
        | "landlord"
        | "developer"
        | "investor"
        | "architect"
        | "engineer"
        | "surveyor"
        | "valuer"
        | "contractor"
        | "lawyer"
        | "financial_institution"
        | "government_partner"
        | "contributor"
        | "administrator"
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
      mkt_agreement_status:
        | "draft"
        | "active"
        | "suspended"
        | "expired"
        | "terminated"
      mkt_availability:
        | "available"
        | "reserved"
        | "sold"
        | "let"
        | "withdrawn"
        | "unknown"
      mkt_commercial_status:
        | "discovery_only"
        | "outreach_pending"
        | "referral_partner"
        | "sales_partner"
      mkt_commission_state:
        | "pending"
        | "approved"
        | "disputed"
        | "invoiced"
        | "paid"
        | "reversed"
      mkt_evidence_class:
        | "registry"
        | "survey"
        | "legal"
        | "professional"
        | "official_publication"
        | "partner_attested"
      mkt_fee_method: "percentage" | "flat" | "hybrid" | "tiered"
      mkt_freshness: "fresh" | "recent" | "stale" | "expired" | "unknown"
      mkt_integration_mode: "outbound" | "curated" | "feed" | "api" | "partner"
      mkt_lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "viewing"
        | "negotiation"
        | "won"
        | "lost"
        | "spam"
      mkt_listing_category:
        | "land"
        | "house"
        | "apartment"
        | "commercial"
        | "industrial"
        | "agricultural"
        | "offplan"
        | "affordable_housing"
        | "rental"
        | "development"
        | "other"
      mkt_listing_intent: "sale" | "rent" | "lease" | "apply"
      mkt_payout_state: "draft" | "invoiced" | "paid" | "failed" | "cancelled"
      mkt_referral_event:
        | "LISTING_IMPRESSION"
        | "LISTING_CLICK"
        | "EXPLORE_HALISIA"
        | "SOURCE_OUTBOUND_CLICK"
        | "ENQUIRY_STARTED"
        | "ENQUIRY_COMPLETED"
        | "CALLBACK_REQUESTED"
        | "VIEWING_REQUESTED"
        | "VIEWING_BOOKED"
        | "VIEWING_COMPLETED"
        | "OFFER_STARTED"
        | "OFFER_SUBMITTED"
        | "RESERVATION"
        | "TRANSACTION_PENDING"
        | "CLOSED_WON"
        | "CLOSED_LOST"
      mkt_source_type:
        | "portal"
        | "developer"
        | "land_company"
        | "government"
        | "agency"
        | "partner"
      mkt_transaction_status:
        | "pending"
        | "closed_won"
        | "closed_lost"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      mkt_verification_status:
        | "SOURCE_LISTED"
        | "HALISIA_REVIEWED"
        | "HALISIA_VERIFIED"
      news_geo_level:
        | "national"
        | "county"
        | "sub_county"
        | "town"
        | "estate"
        | "neighbourhood"
      news_provider: "newsdata" | "gnews" | "gdelt" | "rss"
      news_provider_status:
        | "active"
        | "degraded"
        | "disabled"
        | "awaiting_api_key"
      pro_category:
        | "architect"
        | "engineer"
        | "surveyor"
        | "planner"
        | "valuer"
        | "lawyer"
        | "contractor"
        | "interior_designer"
        | "landscape_designer"
        | "quantity_surveyor"
        | "environmental_consultant"
        | "property_manager"
        | "real_estate_agent"
        | "financial_adviser"
        | "bank"
        | "insurance_provider"
        | "utility_provider"
      pro_verification: "unverified" | "pending" | "verified"
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
      scout_payout_status: "none" | "pending" | "paid"
      scout_profile_status: "pending" | "approved" | "suspended"
      scout_request_status:
        | "quoted"
        | "payment_pending"
        | "payment_verified"
        | "assigned"
        | "requote_pending"
        | "in_progress"
        | "submitted"
        | "corrections_requested"
        | "completed"
        | "cancelled"
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
      app_role: [
        "explorer",
        "buyer",
        "tenant",
        "landowner",
        "seller",
        "land_agent",
        "property_company",
        "landlord",
        "developer",
        "investor",
        "architect",
        "engineer",
        "surveyor",
        "valuer",
        "contractor",
        "lawyer",
        "financial_institution",
        "government_partner",
        "contributor",
        "administrator",
      ],
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
      mkt_agreement_status: [
        "draft",
        "active",
        "suspended",
        "expired",
        "terminated",
      ],
      mkt_availability: [
        "available",
        "reserved",
        "sold",
        "let",
        "withdrawn",
        "unknown",
      ],
      mkt_commercial_status: [
        "discovery_only",
        "outreach_pending",
        "referral_partner",
        "sales_partner",
      ],
      mkt_commission_state: [
        "pending",
        "approved",
        "disputed",
        "invoiced",
        "paid",
        "reversed",
      ],
      mkt_evidence_class: [
        "registry",
        "survey",
        "legal",
        "professional",
        "official_publication",
        "partner_attested",
      ],
      mkt_fee_method: ["percentage", "flat", "hybrid", "tiered"],
      mkt_freshness: ["fresh", "recent", "stale", "expired", "unknown"],
      mkt_integration_mode: ["outbound", "curated", "feed", "api", "partner"],
      mkt_lead_status: [
        "new",
        "contacted",
        "qualified",
        "viewing",
        "negotiation",
        "won",
        "lost",
        "spam",
      ],
      mkt_listing_category: [
        "land",
        "house",
        "apartment",
        "commercial",
        "industrial",
        "agricultural",
        "offplan",
        "affordable_housing",
        "rental",
        "development",
        "other",
      ],
      mkt_listing_intent: ["sale", "rent", "lease", "apply"],
      mkt_payout_state: ["draft", "invoiced", "paid", "failed", "cancelled"],
      mkt_referral_event: [
        "LISTING_IMPRESSION",
        "LISTING_CLICK",
        "EXPLORE_HALISIA",
        "SOURCE_OUTBOUND_CLICK",
        "ENQUIRY_STARTED",
        "ENQUIRY_COMPLETED",
        "CALLBACK_REQUESTED",
        "VIEWING_REQUESTED",
        "VIEWING_BOOKED",
        "VIEWING_COMPLETED",
        "OFFER_STARTED",
        "OFFER_SUBMITTED",
        "RESERVATION",
        "TRANSACTION_PENDING",
        "CLOSED_WON",
        "CLOSED_LOST",
      ],
      mkt_source_type: [
        "portal",
        "developer",
        "land_company",
        "government",
        "agency",
        "partner",
      ],
      mkt_transaction_status: [
        "pending",
        "closed_won",
        "closed_lost",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      mkt_verification_status: [
        "SOURCE_LISTED",
        "HALISIA_REVIEWED",
        "HALISIA_VERIFIED",
      ],
      news_geo_level: [
        "national",
        "county",
        "sub_county",
        "town",
        "estate",
        "neighbourhood",
      ],
      news_provider: ["newsdata", "gnews", "gdelt", "rss"],
      news_provider_status: [
        "active",
        "degraded",
        "disabled",
        "awaiting_api_key",
      ],
      pro_category: [
        "architect",
        "engineer",
        "surveyor",
        "planner",
        "valuer",
        "lawyer",
        "contractor",
        "interior_designer",
        "landscape_designer",
        "quantity_surveyor",
        "environmental_consultant",
        "property_manager",
        "real_estate_agent",
        "financial_adviser",
        "bank",
        "insurance_provider",
        "utility_provider",
      ],
      pro_verification: ["unverified", "pending", "verified"],
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
      scout_payout_status: ["none", "pending", "paid"],
      scout_profile_status: ["pending", "approved", "suspended"],
      scout_request_status: [
        "quoted",
        "payment_pending",
        "payment_verified",
        "assigned",
        "requote_pending",
        "in_progress",
        "submitted",
        "corrections_requested",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
