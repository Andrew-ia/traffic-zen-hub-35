import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface CampaignLibraryItem {
  id: string;
  workspace_id: string;
  name: string;
  objective: string | null;
  schedule_days: string | null;
  audience: string | null;
  budget: number | null;
  budget_type: string;
  copy_primary: string | null;
  copy_title: string | null;
  cta: string | null;
  creative_url: string | null;
  creative_type: string | null;
  status: 'rascunho' | 'ativo' | 'pausado' | 'arquivado';
  notes: string | null;
  tags: string[] | null;
  platform: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_used_at: string | null;
}

export interface CampaignLibraryFilters {
  status?: string;
  objective?: string;
  platform?: string;
  tags?: string;
  search?: string;
}

export interface CreateCampaignInput {
  workspace_id: string;
  name: string;
  objective?: string;
  schedule_days?: string;
  audience?: string;
  budget?: number;
  budget_type?: string;
  copy_primary?: string;
  copy_title?: string;
  cta?: string;
  creative_url?: string;
  creative_type?: string;
  status?: string;
  notes?: string;
  tags?: string[];
  platform?: string;
  created_by?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  objective?: string;
  schedule_days?: string;
  audience?: string;
  budget?: number;
  budget_type?: string;
  copy_primary?: string;
  copy_title?: string;
  cta?: string;
  creative_url?: string;
  creative_type?: string;
  status?: string;
  notes?: string;
  tags?: string[];
  platform?: string;
}

export function useCampaignLibrary(workspaceId: string, filters?: CampaignLibraryFilters) {
  const [campaigns, setCampaigns] = useState<CampaignLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stringify filters to use as dependency
  const filtersKey = useMemo(() => JSON.stringify(filters || {}), [filters?.status, filters?.objective, filters?.platform, filters?.tags, filters?.search]);

  const fetchCampaigns = useCallback(async () => {
    if (!workspaceId) {
      console.warn('⚠️ fetchCampaigns: workspaceId não definido');
      return;
    }

    console.log('🔄 Buscando campanhas...', { workspaceId, filters });
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.objective) params.append('objective', filters.objective);
      if (filters?.platform) params.append('platform', filters.platform);
      if (filters?.tags) params.append('tags', filters.tags);
      if (filters?.search) params.append('search', filters.search);

      const queryString = params.toString();
      const url = `${API_URL}/api/campaigns/library/${workspaceId}${queryString ? `?${queryString}` : ''}`;

      console.log('📡 Fazendo request para:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('📥 Resposta recebida:', { success: data.success, total: data.total, campaigns: data.campaigns?.length });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch campaigns');
      }

      setCampaigns(data.campaigns || []);
      console.log('✅ Campanhas carregadas:', data.campaigns?.length || 0);
    } catch (err: any) {
      console.error('❌ Error fetching campaigns:', err);
      setError(err.message || 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filtersKey]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const getCampaignById = useCallback(async (id: string): Promise<CampaignLibraryItem | null> => {
    try {
      const response = await fetch(`${API_URL}/api/campaigns/library/item/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch campaign');
      }

      return data.campaign;
    } catch (err: any) {
      console.error('Error fetching campaign:', err);
      setError(err.message || 'Failed to fetch campaign');
      return null;
    }
  }, []);

  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<CampaignLibraryItem | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/campaigns/library`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      // Refresh the campaigns list
      await fetchCampaigns();

      return data.campaign;
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      setError(err.message || 'Failed to create campaign');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns]);

  const updateCampaign = useCallback(async (id: string, input: UpdateCampaignInput): Promise<CampaignLibraryItem | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/campaigns/library/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update campaign');
      }

      // Refresh the campaigns list
      await fetchCampaigns();

      return data.campaign;
    } catch (err: any) {
      console.error('Error updating campaign:', err);
      setError(err.message || 'Failed to update campaign');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns]);

  const deleteCampaign = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/campaigns/library/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete campaign');
      }

      // Refresh the campaigns list
      await fetchCampaigns();

      return true;
    } catch (err: any) {
      console.error('Error deleting campaign:', err);
      setError(err.message || 'Failed to delete campaign');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns]);

  const copyCampaign = useCallback(async (id: string, workspace_id?: string): Promise<CampaignLibraryItem | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/campaigns/library/${id}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspace_id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to copy campaign');
      }

      // Refresh the campaigns list
      await fetchCampaigns();

      return data.campaign;
    } catch (err: any) {
      console.error('Error copying campaign:', err);
      setError(err.message || 'Failed to copy campaign');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns]);

  const uploadCreative = useCallback(async (file: File, workspaceId: string): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      console.log('📤 Iniciando upload:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        workspaceId,
      });

      // Generate unique filename
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${workspaceId}/${timestamp}-${cleanFileName}`;

      console.log('📁 Upload para:', filename);

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('creatives')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw new Error(uploadError.message || 'Falha ao fazer upload do arquivo');
      }

      console.log('✅ Upload concluído:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('creatives')
        .getPublicUrl(filename);

      console.log('🔗 URL pública:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (err: any) {
      console.error('❌ Error uploading creative:', err);
      const errorMessage = err.message || 'Failed to upload creative';
      setError(errorMessage);
      throw err; // Re-throw para o componente capturar
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    getCampaignById,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    copyCampaign,
    uploadCreative,
  };
}
