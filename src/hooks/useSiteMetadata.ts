import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PostgrestError } from '@supabase/supabase-js';

interface SiteMetadata {
  id: number;
  owner_id: string;
  site_name: string;
  settings: Record<string, any>;
  created_at: string;
}

interface UseSiteMetadataReturn {
  data: SiteMetadata | null;
  loading: boolean;
  error: PostgrestError | null;
  createMetadata: (siteName: string, settings?: Record<string, any>) => Promise<SiteMetadata>;
  updateMetadata: (updates: Partial<Pick<SiteMetadata, 'site_name' | 'settings'>>) => Promise<SiteMetadata>;
}

export function useSiteMetadata(): UseSiteMetadataReturn {
  const { user } = useAuth();
  const [data, setData] = useState<SiteMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('site_metadata')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) {
        setError(error);
      } else {
        setData(data);
      }
      setLoading(false);
    };

    fetchMetadata();
  }, [user]);

  const createMetadata = async (
    siteName: string,
    settings: Record<string, any> = {}
  ): Promise<SiteMetadata> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('site_metadata')
      .insert({
        owner_id: user.id,
        site_name: siteName,
        settings,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    setData(data);
    return data;
  };

  const updateMetadata = async (
    updates: Partial<Pick<SiteMetadata, 'site_name' | 'settings'>>
  ): Promise<SiteMetadata> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('site_metadata')
      .update(updates)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    setData(data);
    return data;
  };

  return { data, loading, error, createMetadata, updateMetadata };
}
