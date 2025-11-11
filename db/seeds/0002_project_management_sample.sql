-- 0002_project_management_sample.sql
-- Sample data for Project Management system

-- NOTE: This assumes workspace '00000000-0000-0000-0000-000000000010' exists
-- and user '00000000-0000-0000-0000-000000000001' exists

DO $$
DECLARE
    v_workspace_id UUID := '00000000-0000-0000-0000-000000000010';
    v_user_id UUID := '00000000-0000-0000-0000-000000000001';
    v_folder_midia_paga UUID;
    v_folder_infra UUID;
    v_folder_criativos UUID;
    v_list_campanhas_ativas UUID;
    v_list_meta_ads UUID;
    v_list_google_ads UUID;
BEGIN

    -- =====================================================
    -- FOLDERS
    -- =====================================================

    -- Folder: MÍDIA PAGA - OPERACIONAL
    INSERT INTO pm_folders (id, workspace_id, name, icon, color, position, created_by)
    VALUES (gen_random_uuid(), v_workspace_id, 'MÍDIA PAGA - OPERACIONAL', '📁', '#3B82F6', 1, v_user_id)
    RETURNING id INTO v_folder_midia_paga;

    -- Folder: INFRA & INTEGRAÇÕES
    INSERT INTO pm_folders (id, workspace_id, name, icon, color, position, created_by)
    VALUES (gen_random_uuid(), v_workspace_id, 'INFRA & INTEGRAÇÕES', '🔧', '#10B981', 2, v_user_id)
    RETURNING id INTO v_folder_infra;

    -- Folder: CRIATIVOS & CONTEÚDO
    INSERT INTO pm_folders (id, workspace_id, name, icon, color, position, created_by)
    VALUES (gen_random_uuid(), v_workspace_id, 'CRIATIVOS & CONTEÚDO', '🎨', '#F59E0B', 3, v_user_id)
    RETURNING id INTO v_folder_criativos;

    -- =====================================================
    -- LISTS in "MÍDIA PAGA - OPERACIONAL"
    -- =====================================================

    -- List: Campanhas Ativas
    INSERT INTO pm_lists (id, workspace_id, folder_id, name, icon, color, position, created_by)
    VALUES (gen_random_uuid(), v_workspace_id, v_folder_midia_paga, 'Campanhas Ativas', '💝', '#EC4899', 1, v_user_id)
    RETURNING id INTO v_list_campanhas_ativas;

    -- List: Meta Ads
    INSERT INTO pm_lists (id, workspace_id, folder_id, name, icon, color, position, created_by)
    VALUES (gen_random_uuid(), v_workspace_id, v_folder_midia_paga, 'Meta Ads', '📊', '#8B5CF6', 2, v_user_id)
    RETURNING id INTO v_list_meta_ads;

    -- List: Google Ads
    INSERT INTO pm_lists (id, workspace_id, folder_id, name, icon, color, position, created_by)
    VALUES (gen_random_uuid(), v_workspace_id, v_folder_midia_paga, 'Google Ads', '📊', '#3B82F6', 3, v_user_id)
    RETURNING id INTO v_list_google_ads;

    -- =====================================================
    -- TASKS in "Campanhas Ativas"
    -- =====================================================

    INSERT INTO pm_tasks (workspace_id, folder_id, list_id, name, status, priority, position, created_by)
    VALUES
        (v_workspace_id, v_folder_midia_paga, v_list_campanhas_ativas,
         '❤️ CAMPANHA: WhatsApp Leads - Ativa',
         'em_andamento', 'alta', 1, v_user_id),

        (v_workspace_id, v_folder_midia_paga, v_list_campanhas_ativas,
         '⚠️ CAMPANHA: Natal 2025 - Planejamento',
         'pendente', 'alta', 2, v_user_id),

        (v_workspace_id, v_folder_midia_paga, v_list_campanhas_ativas,
         'Ative o Sininho',
         'pendente', 'media', 3, v_user_id);

    -- =====================================================
    -- TASKS in "Meta Ads"
    -- =====================================================

    INSERT INTO pm_tasks (workspace_id, folder_id, list_id, name, description, status, priority, position, created_by)
    VALUES
        (v_workspace_id, v_folder_midia_paga, v_list_meta_ads,
         'Template - Conjunto de Anúncios (Meta)',
         'Template padrão para criar novos conjuntos de anúncios no Meta Ads',
         'pendente', 'media', 1, v_user_id),

        (v_workspace_id, v_folder_midia_paga, v_list_meta_ads,
         'Exemplo - Conjunto: Retargeting 30d',
         'Conjunto de anúncios de retargeting para usuários dos últimos 30 dias',
         'pendente', 'media', 2, v_user_id);

    RAISE NOTICE 'Project Management sample data created successfully!';
    RAISE NOTICE 'Folder MÍDIA PAGA ID: %', v_folder_midia_paga;
    RAISE NOTICE 'List Campanhas Ativas ID: %', v_list_campanhas_ativas;

END $$;
