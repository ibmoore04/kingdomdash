// Phase 5 Database types — matches Phase 2 & 5 Supabase migrations
// Regenerable via `npm run db:types` once Supabase local daemon is running

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Enums: {
      user_role: 'customer' | 'vendor' | 'rider' | 'admin' | 'super_admin'
      business_type: 'restaurant' | 'grocery_store'
      service_type: 'food' | 'grocery' | 'courier'
      application_status: 'pending' | 'approved' | 'rejected'
      order_status:
        | 'pending'
        | 'payment_pending'
        | 'payment_processing'
        | 'payment_confirmed'
        | 'preparing'
        | 'ready_for_pickup'
        | 'picked_up'
        | 'in_transit'
        | 'delivered'
        | 'cancelled'
      payment_status: 'pending' | 'processing' | 'successful' | 'failed' | 'refunded'
      notification_type: 'info' | 'success' | 'warning' | 'error'
      notification_category: 'order' | 'delivery' | 'payment' | 'application' | 'system' | 'promotional'
    }
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          avatar_url: string | null
          role: Database['public']['Enums']['user_role']
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          phone?: string | null
          avatar_url?: string | null
          role?: Database['public']['Enums']['user_role']
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          phone?: string | null
          avatar_url?: string | null
          role?: Database['public']['Enums']['user_role']
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reference_categories: {
        Row: {
          id: string
          name: string
          service_type: Database['public']['Enums']['service_type']
          display_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          service_type: Database['public']['Enums']['service_type']
          display_order?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          service_type?: Database['public']['Enums']['service_type']
          display_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
      vendors: {
        Row: {
          id: string
          profile_id: string
          business_name: string
          business_type: Database['public']['Enums']['business_type']
          business_description: string | null
          business_address: string
          phone: string
          email: string
          logo_url: string | null
          cover_image_url: string | null
          operating_hours: Json | null
          service_area: string | null
          latitude: number | null
          longitude: number | null
          service_area_id: string | null
          is_active: boolean
          rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          business_name: string
          business_type: Database['public']['Enums']['business_type']
          business_description?: string | null
          business_address: string
          phone: string
          email: string
          logo_url?: string | null
          cover_image_url?: string | null
          operating_hours?: Json | null
          service_area?: string | null
          latitude?: number | null
          longitude?: number | null
          service_area_id?: string | null
          is_active?: boolean
          rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          business_name?: string
          business_type?: Database['public']['Enums']['business_type']
          business_description?: string | null
          business_address?: string
          phone?: string
          email?: string
          logo_url?: string | null
          cover_image_url?: string | null
          operating_hours?: Json | null
          service_area?: string | null
          latitude?: number | null
          longitude?: number | null
          service_area_id?: string | null
          is_active?: boolean
          rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendor_services: {
        Row: {
          id: string
          vendor_id: string
          service_type: Database['public']['Enums']['service_type']
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          service_type: Database['public']['Enums']['service_type']
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          service_type?: Database['public']['Enums']['service_type']
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          vendor_id: string
          name: string
          reference_category_id: string | null
          service_type: Database['public']['Enums']['service_type'] | null
          description: string | null
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          name: string
          reference_category_id?: string | null
          service_type?: Database['public']['Enums']['service_type'] | null
          description?: string | null
          display_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          name?: string
          reference_category_id?: string | null
          service_type?: Database['public']['Enums']['service_type'] | null
          description?: string | null
          display_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          vendor_id: string
          category_id: string | null
          name: string
          description: string | null
          price: number
          image_url: string | null
          is_available: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          category_id?: string | null
          name: string
          description?: string | null
          price: number
          image_url?: string | null
          is_available?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          category_id?: string | null
          name?: string
          description?: string | null
          price?: number
          image_url?: string | null
          is_available?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      addresses: {
        Row: {
          id: string
          profile_id: string
          label: string
          recipient_name: string
          phone: string
          address_line_1: string
          address_line_2: string | null
          city: string
          state: string
          postal_code: string | null
          latitude: number | null
          longitude: number | null
          service_area_id: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          label: string
          recipient_name: string
          phone: string
          address_line_1: string
          address_line_2?: string | null
          city?: string
          state?: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          service_area_id?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          label?: string
          recipient_name?: string
          phone?: string
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          state?: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          service_area_id?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          customer_id: string
          vendor_id: string | null
          service_type: Database['public']['Enums']['service_type']
          status: Database['public']['Enums']['order_status']
          pickup_address: string
          delivery_address: string
          delivery_fee: number
          subtotal: number
          total: number
          special_instructions: string | null
          distance_km: number | null
          pricing_rule_id: string | null
          delivery_address_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          vendor_id?: string | null
          service_type: Database['public']['Enums']['service_type']
          status?: Database['public']['Enums']['order_status']
          pickup_address: string
          delivery_address: string
          delivery_fee?: number
          subtotal?: number
          total?: number
          special_instructions?: string | null
          distance_km?: number | null
          pricing_rule_id?: string | null
          delivery_address_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          vendor_id?: string | null
          service_type?: Database['public']['Enums']['service_type']
          status?: Database['public']['Enums']['order_status']
          pickup_address?: string
          delivery_address?: string
          delivery_fee?: number
          subtotal?: number
          total?: number
          special_instructions?: string | null
          distance_km?: number | null
          pricing_rule_id?: string | null
          delivery_address_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          unit_price: number
          quantity: number
          line_total: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          unit_price: number
          quantity: number
          line_total: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          unit_price?: number
          quantity?: number
          line_total?: number
          created_at?: string
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          id: string
          name: string
          description: string | null
          center_lat: number | null
          center_lon: number | null
          radius_km: number | null
          coverage_polygon: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          center_lat?: number | null
          center_lon?: number | null
          radius_km?: number | null
          coverage_polygon?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          center_lat?: number | null
          center_lon?: number | null
          radius_km?: number | null
          coverage_polygon?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_pricing_rules: {
        Row: {
          id: string
          service_type: Database['public']['Enums']['service_type'] | null
          base_fee: number
          distance_rate: number
          min_fee: number | null
          max_fee: number | null
          service_area_id: string | null
          is_active: boolean
          effective_date: string
          expiry_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_type?: Database['public']['Enums']['service_type'] | null
          base_fee: number
          distance_rate: number
          min_fee?: number | null
          max_fee?: number | null
          service_area_id?: string | null
          is_active?: boolean
          effective_date?: string
          expiry_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_type?: Database['public']['Enums']['service_type'] | null
          base_fee?: number
          distance_rate?: number
          min_fee?: number | null
          max_fee?: number | null
          service_area_id?: string | null
          is_active?: boolean
          effective_date?: string
          expiry_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          order_id: string
          customer_id: string | null
          paystack_reference: string | null
          paystack_transaction_id: string | null
          amount: number
          currency: string
          status: Database['public']['Enums']['payment_status']
          channel: string | null
          gateway_response: string | null
          paid_at: string | null
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          customer_id?: string | null
          paystack_reference?: string | null
          paystack_transaction_id?: string | null
          amount: number
          currency?: string
          status?: Database['public']['Enums']['payment_status']
          channel?: string | null
          gateway_response?: string | null
          paid_at?: string | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          customer_id?: string | null
          paystack_reference?: string | null
          paystack_transaction_id?: string | null
          amount?: number
          currency?: string
          status?: Database['public']['Enums']['payment_status']
          channel?: string | null
          gateway_response?: string | null
          paid_at?: string | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          id: string
          payment_id: string | null
          paystack_reference: string
          event_type: string
          idempotency_key: string
          payload: Json
          processed_at: string
        }
        Insert: {
          id?: string
          payment_id?: string | null
          paystack_reference: string
          event_type: string
          idempotency_key: string
          payload: Json
          processed_at?: string
        }
        Update: {
          id?: string
          payment_id?: string | null
          paystack_reference?: string
          event_type?: string
          idempotency_key?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          profile_id: string
          title: string
          message: string
          type: Database['public']['Enums']['notification_type']
          category: Database['public']['Enums']['notification_category']
          is_read: boolean
          action_url: string | null
          idempotency_key: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          title: string
          message: string
          type?: Database['public']['Enums']['notification_type']
          category?: Database['public']['Enums']['notification_category']
          is_read?: boolean
          action_url?: string | null
          idempotency_key?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          title?: string
          message?: string
          type?: Database['public']['Enums']['notification_type']
          category?: Database['public']['Enums']['notification_category']
          is_read?: boolean
          action_url?: string | null
          idempotency_key?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      notification_preferences: {
        Row: {
          profile_id: string
          order_updates: boolean
          delivery_updates: boolean
          payment_updates: boolean
          application_updates: boolean
          promotional: boolean
          operational_alerts: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          order_updates?: boolean
          delivery_updates?: boolean
          payment_updates?: boolean
          application_updates?: boolean
          promotional?: boolean
          operational_alerts?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          order_updates?: boolean
          delivery_updates?: boolean
          payment_updates?: boolean
          application_updates?: boolean
          promotional?: boolean
          operational_alerts?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_distance_km: {
        Args: {
          lat1: number
          lon1: number
          lat2: number
          lon2: number
        }
        Returns: number
      }
      is_location_in_service_area: {
        Args: {
          p_lat: number
          p_lon: number
          p_service_area_id?: string | null
        }
        Returns: boolean
      }
      calculate_delivery_fee_preview: {
        Args: {
          p_vendor_id: string
          p_delivery_address_id: string
          p_service_type: Database['public']['Enums']['service_type']
        }
        Returns: Json
      }
      create_order_secure: {
        Args: {
          p_vendor_id: string
          p_service_type: Database['public']['Enums']['service_type']
          p_pickup_address: string
          p_delivery_address: string
          p_items: Json
          p_special_instructions?: string | null
          p_delivery_address_id?: string | null
        }
        Returns: string
      }
      create_payment_attempt: {
        Args: {
          p_order_id: string
        }
        Returns: Json
      }
      reconcile_paystack_payment: {
        Args: {
          p_reference: string
          p_paystack_transaction_id: string | null
          p_kobo_amount: number
          p_currency: string
          p_channel: string | null
          p_gateway_response: string | null
          p_paid_at: string | null
          p_raw_payload: Json
        }
        Returns: Json
      }
      mark_notification_read: {
        Args: {
          p_notification_id: string
        }
        Returns: void
      }
      mark_all_notifications_read: {
        Args: Record<string, never>
        Returns: number
      }
      clear_read_notifications: {
        Args: Record<string, never>
        Returns: number
      }
      get_unread_notification_count: {
        Args: Record<string, never>
        Returns: number
      }
      emit_notification: {
        Args: {
          p_profile_id: string
          p_title: string
          p_message: string
          p_type: Database['public']['Enums']['notification_type']
          p_category: Database['public']['Enums']['notification_category']
          p_action_url?: string | null
          p_idempotency_key?: string | null
          p_metadata?: Json
          p_is_mandatory?: boolean
        }
        Returns: string | null
      }
      create_courier_order_secure: {
        Args: {
          p_pickup_address: string
          p_pickup_contact: string
          p_pickup_phone: string
          p_pickup_lat?: number | null
          p_pickup_lon?: number | null
          p_delivery_address: string
          p_delivery_contact: string
          p_delivery_phone: string
          p_delivery_lat?: number | null
          p_delivery_lon?: number | null
          p_idempotency_key?: string | null
          p_special_instructions?: string | null
        }
        Returns: Json
      }
      update_vendor_profile_secure: {
        Args: {
          p_vendor_id: string
          p_business_name?: string | null
          p_phone?: string | null
          p_business_address?: string | null
          p_service_area?: string | null
          p_business_description?: string | null
          p_operating_hours?: Json | null
          p_logo_url?: string | null
          p_cover_image_url?: string | null
        }
        Returns: Database['public']['Tables']['vendors']['Row']
      }
      set_vendor_services: {
        Args: {
          p_vendor_id: string
          p_service_types: string[]
        }
        Returns: Json
      }
      vendor_supports_service: {
        Args: {
          p_vendor_id: string
          p_service_type: Database['public']['Enums']['service_type']
        }
        Returns: boolean
      }
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
