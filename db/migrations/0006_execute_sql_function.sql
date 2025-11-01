-- Create execute_sql function for MCP server
-- This function allows the MCP server to execute arbitrary SQL queries

CREATE OR REPLACE FUNCTION public.execute_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data jsonb;
  query_type text;
BEGIN
  -- Determine query type
  query_type := LOWER(SPLIT_PART(TRIM(query), ' ', 1));

  -- Execute the query and return results
  IF query_type IN ('select', 'with') THEN
    -- For SELECT queries, return the result as JSON
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query) INTO result_data;
    RETURN COALESCE(result_data, '[]'::jsonb);
  ELSIF query_type IN ('insert', 'update', 'delete') THEN
    -- For DML queries, execute and return affected rows
    EXECUTE query;
    RETURN jsonb_build_object('success', true, 'message', 'Query executed successfully');
  ELSE
    -- For DDL and other queries
    EXECUTE query;
    RETURN jsonb_build_object('success', true, 'message', 'Query executed successfully');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO authenticated;

COMMENT ON FUNCTION public.execute_sql IS 'Allows MCP server to execute SQL queries';
